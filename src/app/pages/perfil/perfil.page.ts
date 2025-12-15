import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { Turno } from 'src/app/model/turno.model';
import { User } from 'src/app/model/user.model';
import { AuthService } from 'src/app/services/auth.service';
import { TurnoService } from 'src/app/services/turno.service';
import { UserService } from 'src/app/services/user.service';

/**
 * Página de perfil del usuario.
 * Muestra información del usuario autenticado,
 * estadísticas de sus turnos,
 * y permite editar datos como el teléfono o configuración de notificaciones.
 * Permite cerrar sesión y navegar a otras secciones relacionadas con el perfil.
 * 
 */
@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  standalone: false,
  styleUrls: ['./perfil.page.scss'],
})
export class PerfilPage implements OnInit {
  user: User | null = null;
  turnos: Turno[] = [];

  // Estadísticas
  totalGanado: number = 0;
  totalHoras: number = 0;
  totalTurnos: number = 0;

  // Configuración
  notificationsEnabled: boolean = true;

  loading: boolean = true;

  /**Suscripciones que evitan la pérdida de memorai */
  private userSubscription: Subscription = new Subscription();
  private turnosSubscription: Subscription = new Subscription();

  constructor(
    private authService: AuthService,
    private turnoService: TurnoService,
    private userService: UserService, // Añadir UserService
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController
  ) { }

  async ngOnInit() {
    await this.loadUserData();
  }

  /**
   * carga la información del usuario y se suscribe a cambios tanto del usuario autenticado como de sus turnos
   *  
   */
  private async loadUserData() {
    this.loading = true;

    // Suscribirse a cambios del usuario
    this.userSubscription = this.authService.CurrentAppUser.subscribe(async (user) => {
      this.user = user;

      if (user) {
        // Calcular estadísticas
        await this.calculateStatistics(user.id);

        // Cargar configuración de notificaciones
        this.loadNotificationsSetting();
      } else {
        // Resetear estadísticas si no hay usuario
        this.totalGanado = 0;
        this.totalHoras = 0;
        this.totalTurnos = 0;
      }

      this.loading = false;
    });

    // Suscribirse a cambios en los turnos
    this.turnosSubscription = this.turnoService.getTurnosUsuarioObservable().subscribe(turnos => {
      this.turnos = turnos;
      if (this.user) {
        this.calculateStatistics(this.user.id);
      }
    });
  }

  /**
   * calcula las estadísticas del usuario basadas en sus turnos
   * - total ganado
   * - horas trabajadas
   * - número total de turnos
   * @param userId 
   */
  private async calculateStatistics(userId: string) {
    const userTurnos = this.turnos.filter(t => t.userId === userId);

    // Total ganado (salario + propinas)
    this.totalGanado = userTurnos.reduce((total, turno) => {
      return total + (turno.salary || 0) + (turno.tips || 0);
    }, 0);

    // Horas trabajadas
    this.totalHoras = userTurnos.reduce((total, turno) => {
      return total + (turno.hours || 0);
    }, 0);

    // Total de turnos
    this.totalTurnos = userTurnos.length;
  }

  /**
   * carga la configuración de notificaciones del usuario aplicando valores por defecto si no existen
   */
  private loadNotificationsSetting() {
    this.notificationsEnabled = this.user?.settings?.notificationsEnabled ?? true;
  }

  /**Genera un color de avatar basado en el nombre del usuario */
  getAvatarColor(): string {
    const colors = [
      'linear-gradient(135deg, #4b7fff, #6aa6ff)',
      'linear-gradient(135deg, #27b26e, #1db08a)',
      'linear-gradient(135deg, #c365ff, #ff88d2)',
      'linear-gradient(135deg, #ff7a3d, #ffb16a)'
    ];

    if (!this.user) return colors[0];

    // Generar un color basado en el nombre del usuario
    const hash = this.user.name.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);

    return colors[Math.abs(hash) % colors.length];
  }
  /**
   * devuelve las iniciales del nombre del usuario para mostrar en el avatar
   * @returns 
   */
  getUserInitials(): string {
    if (!this.user?.name) return 'U';

    return this.user.name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  /**formatea valores monetarios en euros */
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  //obtiene la fecha del primer turno del usuario
  private getStartDateFromTurnos(): Date | null {
    if (!this.turnos || this.turnos.length === 0) return null;

    // Filtramos solo los turnos del usuario actual
    const userTurnos = this.turnos.filter(t => t.userId === this.user?.id);
    if (userTurnos.length === 0) return null;

    // Ordenamos por fecha ascendente
    const turnosOrdenados = [...userTurnos].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return new Date(turnosOrdenados[0].date);
  }

  //calcula el numero de meses trabajados desde el primer turno
  getWorkingMonths(): number {
    const startDate = this.getStartDateFromTurnos();
    if (!startDate) return 0;

    const now = new Date();
    const months = (now.getFullYear() - startDate.getFullYear()) * 12 +
      (now.getMonth() - startDate.getMonth());

    return Math.max(months, 1); // Al menos 1 mes
  }

  // abre un modal para editar el telefono del usuario
  async editPhone() {
    const alert = await this.alertController.create({
      header: 'Actualizar teléfono',
      inputs: [
        {
          name: 'phone',
          type: 'tel',
          placeholder: 'Número de teléfono',
          value: this.user?.phone || '',
          attributes: {
            maxlength: 15,
            pattern: '[0-9+]*'
          }
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Guardar',
          handler: async (data) => {
            if (data.phone && this.user) {
              await this.updatePhone(data.phone);
            }
          }
        }
      ]
    });

    await alert.present();
  }

  //actualiza el telefono del usuario en Firestore y localmente
  private async updatePhone(phone: string) {
    const loading = await this.loadingController.create({
      message: 'Actualizando teléfono...'
    });
    await loading.present();

    try {
      if (!this.user) {
        throw new Error('No hay usuario autenticado');
      }

      // 1. Guardar en Firestore
      await this.userService.updatePhone(this.user.id, phone);

      // 2. Actualizar localmente
      this.user.phone = phone;

      // 3. Actualizar también en el BehaviorSubject de AuthService
      // Esto es opcional pero mantiene todo sincronizado
      const updatedUser = { ...this.user };

      await loading.dismiss();

      // Mostrar confirmación
      const alert = await this.alertController.create({
        header: 'Éxito',
        message: 'Teléfono actualizado correctamente',
        buttons: ['OK']
      });
      await alert.present();

    } catch (error: any) {
      console.error('Error actualizando teléfono:', error);
      await loading.dismiss();

      const alert = await this.alertController.create({
        header: 'Error',
        message: error.message || 'No se pudo actualizar el teléfono',
        buttons: ['OK']
      });
      await alert.present();
    }
  }
  //activa o desactiva las notificiaciones del usuario y guarda la configuración en Firestore
  async toggleNotifications(event: any) {
    this.notificationsEnabled = event.detail.checked;


    console.log('Notificaciones:', this.notificationsEnabled ? 'Activadas' : 'Desactivadas');

    // Actualizar en el objeto user localmente
    if (this.user) {
      if (!this.user.settings) {
        this.user.settings = {};
      }
      this.user.settings.notificationsEnabled = this.notificationsEnabled;

      // Guardar en Firestore
      try {
        await this.userService.updateUserSettings(this.user.id, {
          notificationsEnabled: this.notificationsEnabled
        });
      } catch (error) {
        console.error('Error guardando configuración de notificaciones:', error);
      }
    }
  }

  //muestra confirmación antes de cerrar sesión
  async logout() {
    const alert = await this.alertController.create({
      header: 'Cerrar sesión',
      message: '¿Estás seguro de que quieres cerrar sesión?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Cerrar sesión',
          role: 'confirm',
          handler: () => {
            this.performLogout();
          }
        }
      ]
    });

    await alert.present();
  }

  //ejecuta el cierre de sesión y maneja errores redijiriendo al login
  private async performLogout() {
    const loading = await this.loadingController.create({
      message: 'Cerrando sesión...'
    });
    await loading.present();

    try {
      await this.authService.logout();
      await loading.dismiss();
      this.router.navigate(['/login'], { replaceUrl: true });
    } catch (error) {
      console.error('Error cerrando sesión:', error);
      await loading.dismiss();

      const alert = await this.alertController.create({
        header: 'Error',
        message: 'No se pudo cerrar sesión',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  // Métodos para navegación Futuras
  openNotifications() {
    console.log('Abrir configuración de notificaciones');

  }

  openSettings() {
    console.log('Abrir ajustes');

  }

  openPrivacy() {
    console.log('Abrir privacidad y seguridad');

  }

  openHelp() {
    console.log('Abrir ayuda y soporte');

  }

  ngOnDestroy() {
    this.userSubscription.unsubscribe();
    this.turnosSubscription.unsubscribe();
  }
}
