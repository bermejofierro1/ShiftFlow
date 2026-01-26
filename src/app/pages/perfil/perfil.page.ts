import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController, ModalController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { Turno } from 'src/app/model/turno.model';
import { User } from 'src/app/model/user.model';
import { AuthService } from 'src/app/services/auth.service';
import { TurnoService } from 'src/app/services/turno.service';
import { UserService } from 'src/app/services/user.service';
import { TurnoModalComponent } from 'src/app/components/turno-modal/turno-modal.component';
import { TurnoReminderService } from 'src/app/services/turno-reminder.service';

/**
 * PÃ¡gina de perfil del usuario.
 * Muestra informaciÃ³n del usuario autenticado,
 * estadÃ­sticas de sus turnos,
 * y permite editar datos como el telÃ©fono o configuraciÃ³n de notificaciones.
 * Permite cerrar sesiÃ³n y navegar a otras secciones relacionadas con el perfil.
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
  userTurnos: Turno[] = [];
  futureTurnos: Turno[] = [];

  // EstadÃ­sticas
  totalGanado: number = 0;
  totalHoras: number = 0;
  totalTurnos: number = 0;
  totalPropinas: number = 0;
  totalIngresos: number = 0;
  mediaPorTurno: number = 0;

  // ConfiguraciÃ³n
  notificationsEnabled: boolean = true;

  loading: boolean = true;

  /**Suscripciones que evitan la pÃ©rdida de memorai */
  private userSubscription: Subscription = new Subscription();
  private turnosSubscription: Subscription = new Subscription();
  private futureTurnosSubscription: Subscription = new Subscription();

  constructor(
    private authService: AuthService,
    private turnoService: TurnoService,
    private userService: UserService, // AÃ±adir UserService
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private modalController: ModalController,
    private turnoReminderService: TurnoReminderService
  ) { }

  async ngOnInit() {
    await this.loadUserData();
  }

  /**
   * carga la informaciÃ³n del usuario y se suscribe a cambios tanto del usuario autenticado como de sus turnos
   *  
   */
  private async loadUserData() {
    this.loading = true;

    // Suscribirse a cambios del usuario
    this.userSubscription = this.authService.CurrentAppUser.subscribe(async (user) => {
      this.user = user;

      if (user) {
        // Calcular estadÃ­sticas
        this.userTurnos = this.turnos.filter(t => t.userId === user.id);
        this.futureTurnos = this.futureTurnos.filter(t => t.userId === user.id);
        await this.calculateStatistics(user.id);

        // Cargar configuraciÃ³n de notificaciones
        this.loadNotificationsSetting();
      } else {
        // Resetear estadÃ­sticas si no hay usuario
        this.userTurnos = [];
        this.futureTurnos = [];
        this.totalGanado = 0;
        this.totalHoras = 0;
        this.totalTurnos = 0;
      }

      this.loading = false;
    });

    // Suscribirse a cambios en los turnos
    this.turnosSubscription = this.turnoService.getTurnosUsuarioObservable().subscribe(turnos => {
      this.turnos = turnos;
      this.userTurnos = this.user ? turnos.filter(t => t.userId === this.user?.id) : [];
      if (this.user) {
        this.calculateStatistics(this.user.id);
      }
    });

    this.futureTurnosSubscription = this.turnoService.getTurnosFuturosObservable().subscribe(turnos => {
      this.futureTurnos = this.user ? turnos.filter(t => t.userId === this.user?.id) : [];
      this.syncFutureTurnoNotifications();
    });
  }

  /**
   * calcula las estadÃ­sticas del usuario basadas en sus turnos
   * - total ganado
   * - horas trabajadas
   * - nÃºmero total de turnos
   * @param userId 
   */
  private async calculateStatistics(userId: string) {
    const userTurnos = this.turnos.filter(t => t.userId === userId);

    const totalSalario = userTurnos.reduce((total, turno) => {
      return total + (turno.salary || 0);
    }, 0);

    const totalPropinas = userTurnos.reduce((total, turno) => {
      return total + (turno.tips || 0);
    }, 0);

    const totalIngresos = totalSalario + totalPropinas;

    // Horas trabajadas
    this.totalHoras = userTurnos.reduce((total, turno) => {
      return total + (turno.hours || 0);
    }, 0);

    // Total de turnos
    this.totalTurnos = userTurnos.length;
    this.totalPropinas = totalPropinas;
    this.totalIngresos = totalIngresos;
    this.totalGanado = totalIngresos;
    this.mediaPorTurno = this.totalTurnos > 0 ? totalIngresos / this.totalTurnos : 0;
  }

  /**
   * carga la configuraciÃ³n de notificaciones del usuario aplicando valores por defecto si no existen
   */
  private loadNotificationsSetting() {
    this.notificationsEnabled = this.user?.settings?.notificationsEnabled ?? true;
  }

  private async syncFutureTurnoNotifications() {
    await this.turnoReminderService.syncFutureTurnoNotifications(
      this.futureTurnos,
      this.notificationsEnabled
    );
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

  formatTurnoDate(dateValue: string): string {
    if (!dateValue) return '';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return dateValue;

    return new Intl.DateTimeFormat('es-ES', {
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    }).format(date);
  }

  async onFutureTurnoClick(turno: Turno) {
    if (!this.user?.id) return;

    const alert = await this.alertController.create({
      header: 'Turno futuro',
      message: '¿Has realizado este turno?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'No, eliminar',
          role: 'destructive',
          handler: async () => {
            await this.turnoService.deleteTurnoFuturo(this.user!.id, turno.id);
          }
        },
        {
          text: 'Sí­, realizado',
          handler: async () => {
            const modal = await this.modalController.create({
              component: TurnoModalComponent,
              componentProps: {
                userId: this.user!.id,
                initialTurno: {
                  date: turno.date,
                  startTime: turno.startTime,
                  endTime: turno.endTime,
                  tips: turno.tips,
                  location: turno.location,
                  notes: turno.notes,
                  breakTime: turno.breakTime,
                  status: 'completed'
                }
              },
              cssClass: 'turno-modal-class'
            });

            await modal.present();
            const { data } = await modal.onDidDismiss();
            if (data?.success) {
              await this.turnoService.deleteTurnoFuturo(this.user!.id, turno.id);
            }
          }
        }
      ]
    });

    await alert.present();
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
      header: 'Actualizar telÃ©fono',
      inputs: [
        {
          name: 'phone',
          type: 'tel',
          placeholder: 'NÃºmero de telÃ©fono',
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

  //Editar el precio por hora que gana el usuario ante posibles cambios
  async editHourlyRate() {
    const alert = await this.alertController.create({
      header: 'Actualizar â‚¬/hora',
      inputs: [
        {
          name: 'hourlyRate',
          type: 'number',
          placeholder: 'Ej: 10',
          value: (this.user?.hourlyRate ?? 10).toString(),
          attributes: { min: 0, step: '0.1' }
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async (data) => {
            const value = Number(data.hourlyRate);
            if (!this.user) return;

            if (Number.isNaN(value) || value <= 0) {
              const a = await this.alertController.create({
                header: 'Dato invÃ¡lido',
                message: 'Introduce un nÃºmero mayor que 0',
                buttons: ['OK'],
              });
              await a.present();
              return false; // evita que se cierre el alert
            }

            await this.updateHourlyRate(value);
            return true;
          }
        }
      ]
    });

    await alert.present();
  }
  //Actualizar el precio por hora
  private async updateHourlyRate(hourlyRate: number) {
    const loading = await this.loadingController.create({
      message: 'Actualizando â‚¬/hora...'
    });
    await loading.present();

    try {
      if (!this.user) throw new Error('No hay usuario autenticado');

      await this.userService.updateUser(this.user.id, { hourlyRate });

      // actualizar local
      this.user.hourlyRate = hourlyRate;

      await loading.dismiss();

      const alert = await this.alertController.create({
        header: 'Ã‰xito',
        message: 'â‚¬/hora actualizado correctamente',
        buttons: ['OK']
      });
      await alert.present();
    } catch (error: any) {
      await loading.dismiss();
      const alert = await this.alertController.create({
        header: 'Error',
        message: error.message || 'No se pudo actualizar el â‚¬/hora',
        buttons: ['OK']
      });
      await alert.present();
    }
  }


  //actualiza el telefono del usuario en Firestore y localmente
  private async updatePhone(phone: string) {
    const loading = await this.loadingController.create({
      message: 'Actualizando telÃ©fono...'
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

      // 3. Actualizar tambiÃ©n en el BehaviorSubject de AuthService
      // Esto es opcional pero mantiene todo sincronizado
      const updatedUser = { ...this.user };

      await loading.dismiss();

      // Mostrar confirmaciÃ³n
      const alert = await this.alertController.create({
        header: 'Ã‰xito',
        message: 'TelÃ©fono actualizado correctamente',
        buttons: ['OK']
      });
      await alert.present();

    } catch (error: any) {
      console.error('Error actualizando telÃ©fono:', error);
      await loading.dismiss();

      const alert = await this.alertController.create({
        header: 'Error',
        message: error.message || 'No se pudo actualizar el telÃ©fono',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  //actualizar el correo del usuario

  async editEmail() {
    const alert = await this.alertController.create({
      header: 'Actualizar email',
      message: 'Para cambiar el email, introduce tu contraseÃ±a actual (Firebase lo requiere).',
      inputs: [
        {
          name: 'newEmail',
          type: 'email',
          placeholder: 'Nuevo email',
          value: this.user?.email || ''
        },
        {
          name: 'password',
          type: 'password',
          placeholder: 'ContraseÃ±a actual'
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async (data) => {
            if (!this.user) return;

            const newEmail = (data.newEmail || '').trim();
            const password = data.password || '';

            if (!newEmail.includes('@')) {
              const a = await this.alertController.create({
                header: 'Email invÃ¡lido',
                message: 'Introduce un email vÃ¡lido',
                buttons: ['OK'],
              });
              await a.present();
              return false;
            }

            if (!password || password.length < 6) {
              const a = await this.alertController.create({
                header: 'ContraseÃ±a requerida',
                message: 'Introduce tu contraseÃ±a actual',
                buttons: ['OK'],
              });
              await a.present();
              return false;
            }

            await this.updateEmailFlow(password, newEmail);
            return true;
          }
        }
      ]
    });

    await alert.present();
  }

  private async updateEmailFlow(currentPassword: string, newEmail: string) {
    const loading = await this.loadingController.create({
      message: 'Actualizando email...'
    });
    await loading.present();

    try {
      if (!this.user) throw new Error('No hay usuario autenticado');

      // 1) Actualiza en Firebase Auth
      await this.authService.changeEmail(currentPassword, newEmail);

      // 2) Actualiza en Firestore
      await this.userService.updateUser(this.user.id, { email: newEmail });

      // 3) Actualiza local
      this.user.email = newEmail;

      await loading.dismiss();

      const alert = await this.alertController.create({
        header: 'Ã‰xito',
        message: 'Email actualizado correctamente',
        buttons: ['OK']
      });
      await alert.present();
    } catch (error: any) {
      await loading.dismiss();

      const msg = (() => {
        if (error?.code === 'auth/wrong-password') return 'ContraseÃ±a incorrecta.';
        if (error?.code === 'auth/email-already-in-use') return 'Ese email ya estÃ¡ en uso.';
        if (error?.code === 'auth/requires-recent-login') return 'Vuelve a iniciar sesiÃ³n y repite el cambio.';
        return error.message || 'No se pudo actualizar el email';
      })();

      const alert = await this.alertController.create({
        header: 'Error',
        message: msg,
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  //activa o desactiva las notificiaciones del usuario y guarda la configuraciÃ³n en Firestore
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
        await this.syncFutureTurnoNotifications();
      } catch (error) {
        console.error('Error guardando configuraciÃ³n de notificaciones:', error);
      }
    }
  }

  //muestra confirmaciÃ³n antes de cerrar sesiÃ³n
  async logout() {
    const alert = await this.alertController.create({
      header: 'Cerrar sesiÃ³n',
      message: 'Â¿EstÃ¡s seguro de que quieres cerrar sesiÃ³n?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Cerrar sesiÃ³n',
          role: 'confirm',
          handler: () => {
            this.performLogout();
          }
        }
      ]
    });

    await alert.present();
  }

  //ejecuta el cierre de sesiÃ³n y maneja errores redijiriendo al login
  private async performLogout() {
    const loading = await this.loadingController.create({
      message: 'Cerrando sesiÃ³n...'
    });
    await loading.present();

    try {
      await this.authService.logout();
      await loading.dismiss();
      this.router.navigate(['/login'], { replaceUrl: true });
    } catch (error) {
      console.error('Error cerrando sesiÃ³n:', error);
      await loading.dismiss();

      const alert = await this.alertController.create({
        header: 'Error',
        message: 'No se pudo cerrar sesiÃ³n',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  // MÃ©todos para navegaciÃ³n Futuras
  openNotifications() {
    this.router.navigate(['/tabs/notificaciones']);
  }

  openSettings() {
    this.router.navigate(['/tabs/ajustes']);
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
    this.futureTurnosSubscription.unsubscribe();
  }
}

