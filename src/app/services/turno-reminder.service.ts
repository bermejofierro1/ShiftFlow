import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Turno } from '../model/turno.model';

@Injectable({
  providedIn: 'root',
})
export class TurnoReminderService {
  async syncFutureTurnoNotifications(turnos: Turno[], enabled: boolean): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    if (!enabled) {
      await this.clearAllNotifications();
      return;
    }

    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== 'granted') return;

    await this.clearAllNotifications();

    const now = new Date();
    const notifications: {
      id: number;
      title: string;
      body: string;
      schedule: { at: Date };
    }[] = [];

    for (const turno of turnos) {
      if (turno.status !== 'scheduled') continue;
      const diff = this.daysDiffFromToday(turno.date);
      if (diff === null) continue;

      if (diff === -1) {
        const fireAt = this.buildFireAtBeforeStart(turno);
        if (fireAt && fireAt > now) {
          notifications.push({
            id: this.buildNotificationId(turno, 'pre'),
            title: 'Turno mañana',
            body: `Mañana empiezas a las ${turno.startTime}.`,
            schedule: { at: fireAt },
          });
        }
      }

      if (diff === 1) {
        const reminderTimes = this.buildReminderTimes();
        reminderTimes.forEach((fireAt, index) => {
          if (fireAt > now) {
            notifications.push({
              id: this.buildNotificationId(turno, `follow_${index + 1}`),
              title: 'Confirmar turno',
              body: `¿Has realizado el turno del ${turno.date}?`,
              schedule: { at: fireAt },
            });
          }
        });
      }
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  }

  async getPendingCount(): Promise<number> {
    if (!Capacitor.isNativePlatform()) return 0;
    const pending = await LocalNotifications.getPending();
    return pending.notifications.length;
  }

  async scheduleTestNotification(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== 'granted') return;

    const fireAt = new Date(Date.now() + 10 * 1000);
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 999999,
          title: 'Notificación de prueba',
          body: 'Esto es una prueba de recordatorios.',
          schedule: { at: fireAt },
        },
      ],
    });
  }

  private async clearAllNotifications(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
  }

  private buildFireAtBeforeStart(turno: Turno): Date | null {
    if (!turno.date || !turno.startTime) return null;
    const [y, m, d] = turno.date.split('-').map(Number);
    const [hh, mm] = turno.startTime.split(':').map(Number);
    if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return null;
    const start = new Date(y, m - 1, d, hh, mm, 0, 0);
    return new Date(start.getTime() - 60 * 60 * 1000);
  }

  private buildReminderTimes(): Date[] {
    const today = new Date();
    return [
      new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0),
      new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 0, 0, 0),
    ];
  }

  private daysDiffFromToday(dateValue: string): number | null {
    if (!dateValue) return null;
    const parts = dateValue.split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    const [y, m, d] = parts;
    const target = new Date(y, m - 1, d);
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.round((todayStart.getTime() - target.getTime()) / (24 * 60 * 60 * 1000));
  }

  private buildNotificationId(turno: Turno, suffix: string): number {
    const base = `${turno.id}_${turno.date}_${turno.startTime}_${suffix}`;
    let hash = 0;
    for (let i = 0; i < base.length; i++) {
      hash = (hash << 5) - hash + base.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}
