import { Component, OnDestroy, OnInit } from '@angular/core';
import { Turno } from 'src/app/model/turno.model';
import { TurnoService } from 'src/app/services/turno.service';
import { parseISO, format } from 'date-fns'
import { AlertController, ModalController } from '@ionic/angular';
import { TurnoModalComponent } from 'src/app/components/turno-modal/turno-modal.component';
import { AuthService } from 'src/app/services/auth.service';
import { filter, Subscription, take } from 'rxjs';
/**
 * Página de listado y gestión de turnos.
 * Permite:
 * - visualizar los turnos agrupados por semana,
 * - crear nuevos turnos mediante un modal,
 * - editar y eliminar turnos existentes,
 * - suscribirse a cambios en tiempo real de los turnos del usuario autenticado.
 */
@Component({
  selector: 'app-turnos',
  templateUrl: './turnos.page.html',
  standalone: false,
  styleUrls: ['./turnos.page.scss'],
})
export class TurnosPage implements OnInit, OnDestroy {

  userIdActual: string | null = null;
  turnosPorSemana: { weekLabel: string, salarioTotal: number, horasTotales: number, turnos: Turno[] }[] = [];
  loading = false;

  //suscripción al usuario autenticado
  private authSubscription!: Subscription;
  //suscripción a los turnos en tiempo real
  private turnosSubscription!: Subscription;

  constructor(
    private turnoService: TurnoService,
    private modalController: ModalController,
    private authService: AuthService,
    private alertController: AlertController // Inyectar AlertController
  ) { }

  ngOnInit() {
    this.loading = true;

    // Suscribirse a cambios de autenticación
    this.authSubscription = this.authService.CurrentAppUser.subscribe(
      (user) => {
        if (user) {
          this.userIdActual = user.id;
          console.log('UsuarioId actual', this.userIdActual);

          // Suscribirse a cambios en tiempo real de los turnos
          this.subscribeToTurnos();
        } else {
          this.userIdActual = null;
          this.turnosPorSemana = [];
          this.loading = false;
          console.log('No hay usuario autenticado');
        }
      },
      (error) => {
        console.error('Error en suscripción de usuario:', error);
        this.loading = false;
      }
    );
  }

  private subscribeToTurnos() {
    // Cancelar suscripción anterior si existe
    if (this.turnosSubscription) {
      this.turnosSubscription.unsubscribe();
    }

    // Suscribirse a cambios en tiempo real
    this.turnosSubscription = this.turnoService.getTurnosUsuarioObservable().subscribe(
      (turnos) => {
        console.log('Turnos actualizados en tiempo real:', turnos.length);

        // Filtrar turnos del usuario actual
        const turnosUsuario = turnos.filter(t => t.userId === this.userIdActual);

        // Agrupar por semana
        this.grupoTurnosPorSemana(turnosUsuario);

        this.loading = false;
      },
      (error) => {
        console.error('Error en suscripción de turnos:', error);
        this.loading = false;
      }
    );
  }
  /**
   * agrupa los turnos por semana y calcula totales:
   * - agrupa por clave ISO de semana,
   * - calcula salario y horas totales por semana,
   * - ordena semanas y turnos por fecha descendente.
   * @param turnos 
   * @returns 
   */
  grupoTurnosPorSemana(turnos: Turno[]) {
    if (!turnos || turnos.length === 0) {
      this.turnosPorSemana = [];
      return;
    }

    const map: { [week: string]: Turno[] } = {};

    turnos.forEach(t => {
      try {
        const date = parseISO(t.date);
        const weekKey = format(date, "yyyy-'W'II");
        if (!map[weekKey]) map[weekKey] = [];
        map[weekKey].push(t);
      } catch (error) {
        console.error('Error procesando turno:', t, error);
      }
    });

    this.turnosPorSemana = Object.keys(map).map(week => {
      const turnosSemana = map[week];
      const salarioTotal = turnosSemana.reduce((acc, t) => acc + t.salary + t.tips, 0);
      const horasTotales = turnosSemana.reduce((acc, t) => acc + t.hours, 0);

      // Ordenar turnos por fecha descendente
      turnosSemana.sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      const weekLabel = `Semana del ${format(parseISO(turnosSemana[0].date), 'eee, dd MMM')}`;
      return { weekLabel, salarioTotal, horasTotales, turnos: turnosSemana };
    });

    // Ordenar semanas descendente
    this.turnosPorSemana.sort((a, b) => {
      return new Date(b.turnos[0].date).getTime() - new Date(a.turnos[0].date).getTime();
    });
  }

  /**
   * formatea una fecha para mostrar en la UI
   * @param date 
   * @returns 
   */
  formatDate(date: string): string {
    return format(parseISO(date), 'eee, dd MMM');
  }

  /**
   * Abre el modal para crear un nuevo turno:
   * @returns 
   */
  async abrirCrearTurno() {
    console.log('Abriendo modal...');

    if (!this.userIdActual) {
      console.error('No hay usuario autenticado');
      return;
    }

    const modal = await this.modalController.create({
      component: TurnoModalComponent,
      componentProps: { userId: this.userIdActual },
      cssClass: 'turno-modal-class'
    });

    await modal.present();
  }

  // Método para eliminar turno con confirmación
  async eliminarTurno(turnoId: string) {
    if (!this.userIdActual) return;

    const alert = await this.alertController.create({
      header: 'Confirmar eliminación',
      message: '¿Estás seguro de que quieres eliminar este turno?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: 'Eliminar',
          handler: async () => {
            try {
              await this.turnoService.deleteTurno(this.userIdActual!, turnoId);
              // No necesitamos actualizar manualmente porque onSnapshot lo hará automáticamente
            } catch (error) {
              console.error('Error eliminando turno:', error);
            }
          }
        }
      ]
    });

    await alert.present();
  }

  // Abre el modal para editar turno
  async editarTurno(turno: Turno) {
    if (!this.userIdActual) return;

    const modal = await this.modalController.create({
      component: TurnoModalComponent,
      componentProps: {
        userId: this.userIdActual,
        turno: turno,
        modoEdicion: true
      },
      cssClass: 'turno-modal-class'
    });

    await modal.present();
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    if (this.turnosSubscription) {
      this.turnosSubscription.unsubscribe();
    }
  }
}
