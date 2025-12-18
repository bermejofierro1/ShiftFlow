import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { compareDesc, endOfWeek, format, isSameMonth, isSameWeek, parseISO, startOfWeek, subMonths } from 'date-fns';
import { filter, Subscription, take } from 'rxjs';
import { Turno } from 'src/app/model/turno.model';
import { AuthService } from 'src/app/services/auth.service';
import { TurnoService } from 'src/app/services/turno.service';

/**
 * p7gina principal de la aplicaci3n.
 * muestra un resumen del rendimiento del usuario autenticado:
 * - ingresos y propinas del mes actual
  * - comparaci3n con el mes anterior
  * - turnos trabajados, horas totales y m7tricas adicionales
  * - lista de los 8ltimos turnos trabajados
 */
@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  standalone: false,
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit, OnDestroy {

  // M7tricas del mes actual
  ingresosMes = 0;
  propinasMes = 0;
  turnosTrabajadosMes = 0;
  horasTotalesMes = 0;

  // Para comparaci3n con mes anterior
  ingresosMesAnterior = 0;
  propinasMesAnterior = 0;
  turnosMesAnterior = 0;

  // 7ltimos turnos
  ultimosTurnos: Turno[] = [];
  allTurnos: Turno[] = [];

  loading = true;
  userId: string | null = null;
  private turnosSub?: Subscription;

  constructor(
    private turnoService: TurnoService,
    private authService: AuthService,
    private cd: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    await this.loadData();
  }

  ngOnDestroy(): void {
    this.turnosSub?.unsubscribe();
  }

  /**
   * carga los datos necesarios para la p7gina de inicio:
   * - obtiene el usuario autenticado
   * - se suscribe a los turnos del usuario en tiempo real
   * - procesa y calcula las m7tricas a mostrar
   * @returns 
   */
  async loadData() {
    this.loading = true;

    // Esperamos al usuario autenticado
    const user = await this.authService.CurrentAppUser
      .pipe(filter(u => u != null), take(1))
      .toPromise();

    this.userId = user?.id || null;
    if (!this.userId) {
      console.warn('No hay usuario autenticado en HomePage');
      this.loading = false;
      return;
    }

    // Suscripci3n en tiempo real
    this.turnosSub = this.turnoService.getTurnosUsuarioObservable()
      .subscribe(turnos => {
        this.processTurnosData(turnos);
      });
  }

  /**
   * procesa los turnos del usuario:
   * - filtra los turnos del usuario actual
   * - ordena por fecha descendente
   * - calcula m7tricas del mes actual y anterior
   * - actualiza el dashboard
   * @param turnos 
   */
  private processTurnosData(turnos: Turno[]) {
    // Filtrar solo los del usuario actual
    const misTurnos = turnos.filter(t => t.userId === this.userId);
    this.allTurnos = misTurnos;

    // Ordenar por fecha+hora descendente
    misTurnos.sort((a, b) => {
      const dateA = parseISO(a.date + 'T' + (a.startTime ?? '00:00'));
      const dateB = parseISO(b.date + 'T' + (b.startTime ?? '00:00'));
      return compareDesc(dateA, dateB);
    });

    // 7ltimos 6 turnos
    this.ultimosTurnos = misTurnos.slice(0, 6);

    // Calcular m7tricas
    this.calculateMonthlyMetrics(misTurnos);
    this.calculatePreviousMonthMetrics(misTurnos);

    this.loading = false;
    this.cd.detectChanges();
  }

  /**
   * calcula las m7tricas del mes actual:
   * - ingresos
   * - propinas
   * - turnos trabajados
   * -  horas totales
   * @param turnos 
   */
  private calculateMonthlyMetrics(turnos: Turno[]) {
    const now = new Date();
    let ingresos = 0, propinas = 0, cnt = 0, horas = 0;

    turnos.forEach(t => {
      const d = parseISO(t.date);
      if (isNaN(d.getTime())) return;
      if (isSameMonth(d, now)) {
        const salary = Number(t.salary ?? 0);
        const tips = Number(t.tips ?? 0);
        const hrs = Number(t.hours ?? 0);

        ingresos += salary + tips;
        propinas += tips;
        cnt += 1;
        horas += hrs;
      }
    });

    this.ingresosMes = Math.round(ingresos * 100) / 100;
    this.propinasMes = Math.round(propinas * 100) / 100;
    this.turnosTrabajadosMes = cnt;
    this.horasTotalesMes = Math.round(horas * 100) / 100;
  }

  /**
   * calcula las m7tricas del mes anterior:
   * - ingresos
   * - propinas
   * - turnos trabajados
   * @param turnos 
   */
  private calculatePreviousMonthMetrics(turnos: Turno[]) {
    const now = new Date();
    const lastMonth = subMonths(now, 1);
    let ingresos = 0, propinas = 0, cnt = 0;

    turnos.forEach(t => {
      const d = parseISO(t.date);
      if (isNaN(d.getTime())) return;
      if (isSameMonth(d, lastMonth)) {
        const salary = Number(t.salary ?? 0);
        const tips = Number(t.tips ?? 0);

        ingresos += salary + tips;
        propinas += tips;
        cnt += 1;
      }
    });

    this.ingresosMesAnterior = Math.round(ingresos * 100) / 100;
    this.propinasMesAnterior = Math.round(propinas * 100) / 100;
    this.turnosMesAnterior = cnt;
  }

  // M7todos para el nuevo dise5o
  /**
   * calcula el porcentaje de cambio de ingresos entre el mes actual y el anterior.
   * @returns 
   */
  calculateIncomeChange(): number {
    if (this.ingresosMesAnterior === 0) return 0;
    const change = ((this.ingresosMes - this.ingresosMesAnterior) / this.ingresosMesAnterior) * 100;
    return Math.round(change * 10) / 10; // Redondear a 1 decimal
  }

  /**
   * calcula el porcentaje de cambio en propinas
   * @returns 
   */
  calculateTipsChange(): number {
    if (this.propinasMesAnterior === 0) return 0;
    const change = ((this.propinasMes - this.propinasMesAnterior) / this.propinasMesAnterior) * 100;
    return Math.round(change * 10) / 10;
  }

  /**
   * devuelve el n8mero de turnos trabajados en la semana actual
   * @returns 
   */
  calculateWeeklyShifts(): number {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    return this.allTurnos.filter(t => {
      try {
        const d = parseISO(t.date);
        return d >= weekStart && d <= weekEnd;
      } catch {
        return false;
      }
    }).length;
  }

  calculateHourlyRate(): number {
    if (this.horasTotalesMes === 0) return 0;
    return (this.ingresosMes + this.propinasMes) / this.horasTotalesMes;
  }

  calculateTotalIncome(): number {
    return this.ingresosMes + this.propinasMes;
  }

  calculateTurnoTotal(turno: Turno): number {
    return (turno.salary || 0) + (turno.tips || 0);
  }

  getDayFromDate(dateStr: string): string {
    try {
      const d = parseISO(dateStr);
      return d.getDate().toString();
    } catch {
      return '--';
    }
  }

  getMonthFromDate(dateStr: string): string {
    try {
      const d = parseISO(dateStr);
      const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
      return months[d.getMonth()];
    } catch {
      return '---';
    }
  }

  getWeekdayFromDate(dateStr: string): string {
    try {
      const d = parseISO(dateStr);
      const weekdays = ['Domingo', 'Lunes', 'Martes', 'Mi9rcoles', 'Jueves', 'Viernes', 'S9bado'];
      return weekdays[d.getDay()];
    } catch {
      return this.formatDateSmall(dateStr);
    }
  }

  /**
   * formatea valores monetarios en euros
   * @param v 
   * @returns 
   */
  formatCurrency(v: number) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v);
  }

  prettyHours(h: number) {
    return `${h}h`;
  }

  formatDateSmall(dateStr: string) {
    try {
      const d = parseISO(dateStr);
      return d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
    } catch {
      return dateStr;
    }
  }

  hoursPerShift() {
    return this.turnosTrabajadosMes ? (this.horasTotalesMes / this.turnosTrabajadosMes) : 0;
  }

  // M7todo para refrescar datos
  refreshData(event?: any) {
    this.loading = true;

    // volvemos a cargar los datos
    setTimeout(() => {
      // Re-procesar los datos actuales
      this.processTurnosData(this.allTurnos);

      this.loading = false;
      if (event && event.target) {
        event.target.complete();
      }
      this.cd.detectChanges();
    }, 1000);
  }

  ionViewWillEnter() {
    // Recargar datos cuando se entra a la p7gina
    if (!this.loading) {
      this.cd.detectChanges();
    }
  }
}
