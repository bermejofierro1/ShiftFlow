import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';
import { TurnoReminderService } from 'src/app/services/turno-reminder.service';
import { TurnoService } from 'src/app/services/turno.service';
import { UserService } from 'src/app/services/user.service';
import { User } from 'src/app/model/user.model';
import { Turno } from 'src/app/model/turno.model';

@Component({
  selector: 'app-notificaciones',
  templateUrl: './notificaciones.page.html',
  standalone: false,
  styleUrls: ['./notificaciones.page.scss'],
})
export class NotificacionesPage implements OnInit, OnDestroy {
  user: User | null = null;
  notificationsEnabled = true;
  futureTurnos: Turno[] = [];
  pendingNotifications = 0;

  private authSubscription!: Subscription;
  private futureTurnosSubscription!: Subscription;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private turnoService: TurnoService,
    private turnoReminderService: TurnoReminderService
  ) {}

  async ngOnInit() {
    this.authSubscription = this.authService.CurrentAppUser.subscribe((user) => {
      this.user = user;
      this.notificationsEnabled = user?.settings?.notificationsEnabled ?? true;
    });

    this.futureTurnosSubscription = this.turnoService.getTurnosFuturosObservable().subscribe((turnos) => {
      this.futureTurnos = this.user ? turnos.filter(t => t.userId === this.user?.id) : [];
      this.syncNotifications();
    });

    await this.refreshPendingCount();
  }

  async toggleNotifications(event: any) {
    this.notificationsEnabled = event.detail.checked;
    if (!this.user) return;

    if (!this.user.settings) {
      this.user.settings = {};
    }
    this.user.settings.notificationsEnabled = this.notificationsEnabled;

    await this.userService.updateUserSettings(this.user.id, {
      notificationsEnabled: this.notificationsEnabled
    });

    await this.syncNotifications();
  }

  async syncNotifications() {
    await this.turnoReminderService.syncFutureTurnoNotifications(
      this.futureTurnos,
      this.notificationsEnabled
    );
    await this.refreshPendingCount();
  }

  async testNotification() {
    await this.turnoReminderService.scheduleTestNotification();
    await this.refreshPendingCount();
  }

  private async refreshPendingCount() {
    this.pendingNotifications = await this.turnoReminderService.getPendingCount();
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    if (this.futureTurnosSubscription) {
      this.futureTurnosSubscription.unsubscribe();
    }
  }
}
