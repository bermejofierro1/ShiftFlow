import { Component, ElementRef, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { addDays, endOfWeek, endOfMonth, format, isSameMonth, parseISO, startOfWeek } from 'date-fns';
import { Turno } from 'src/app/model/turno.model';
import { TurnoService } from 'src/app/services/turno.service';
import {
  Chart,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

Chart.register(
  BarController, BarElement,
  LineController, LineElement, PointElement,
  CategoryScale, LinearScale,
  Title, Tooltip, Legend
);
Chart.register(Filler);

/**
 * Página de estadísticas avanzadas del usuario.
 * proporciona analisis detallado de los turnos trabajados mediante:
 * - gráficos de ingresos y horas trabajadas
 * - filtros por periodo
 * - filtro por ubicación
 * - métricas históricas y comparativas
 * - proyecciones mensuales y meta salariales
 * - recomendaciones basadas en rendimiento histórico
 */
@Component({
  selector: 'app-stats',
  templateUrl: './stats.page.html',
  standalone: false,
  styleUrls: ['./stats.page.scss'],
})
export class StatsPage implements OnInit, AfterViewInit {

  //Referencia a los canvas donde se renderizan los gráficos
  @ViewChild('ingresosCanvas', { static: false }) ingresosCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('horasCanvas', { static: false }) horasCanvas!: ElementRef<HTMLCanvasElement>;

  //instancias de Chart.js
  ingresosChart!: Chart;
  horasChart!: Chart;

  turnos: Turno[] = [];
  periodo: 'mes' | 'semana' | 'rango' = 'mes';
  rangeInicio = '';
  rangeFin = '';
  selectedLocation = 'all';
  locations: string[] = [];

  //Métricas principales
  salarioTotal = 0;
  propinasTotal = 0;
  promedioPorTurno = 0;
  totalHoras = 0;

  //métricas históricas y comparativas
  totalIngresos = 0;
  mejorMes = '';
  ingresosMejorMes = 0;
  promedioTotal = 0;

  //variables relacionadas con metas mensuales y proyecciones y planificación del trabajo
  projectedIngresosMes = 0;
  projectedPropinasMes = 0;
  proyeccionVsMejorMes = 0;
  ingresosMesActual = 0;
  horasMesActual = 0;
  turnosMesActual = 0;
  mediaIngresoTurnoMes = 0;
  mediaHorasTurnoMes = 0;
  turnosParaIgualar = 0;
  horasParaIgualar = 0;
  mediaIngresoHoraMes = 0;
  monthlyGoal = 0;
  monthlyGoalInput = '';
  goalProgress = 0;
  goalRemaining = 0;
  goalTurnosNecesarios = 0;
  goalHorasNecesarias = 0;
  diasRestantesMes = 0;
  recordatorioActivo = false;
  recordatorioTurnos = 0;
  recordatorioHoras = 0;
  recordatorioTextoUbicacion = '';
  recordatorioTextoFranja = '';
  recordatorioIngresoHoraRef = 0;
  hotspotUbicacion = '';
  hotspotFranja = '';
  hotspotRate = 0;
  weeklyPlanActivo = false;
  weeklyPlan: { fecha: string; turnos: number; horas: number; ubicacion: string; franja: string; rate: number }[] = [];
  weeklyPlanTurnosNecesarios = 0;
  weeklyPlanHorasNecesarias = 0;

  loading = true;
  private metaStorageKey = 'turnos_meta_salarial';

  constructor(private turnoService: TurnoService) { }

  ngOnInit() {
    this.setDefaultRange();
    this.loadMonthlyGoal();
    this.turnoService.getTurnosUsuarioObservable().subscribe(turnos => {
      this.turnos = turnos;
      this.updateLocations();
      this.calcularMetricas();
      this.loading = false;

      if (this.ingresosCanvas?.nativeElement && this.horasCanvas?.nativeElement) {
        this.renderCharts();
      }
    });
  }

  ngAfterViewInit() {
    if (this.turnos.length > 0) {
      this.renderCharts();
    }
  }

  cambiarPeriodo(p: 'mes' | 'semana' | 'rango') {
    this.periodo = p;
    this.calcularMetricas();
    this.renderCharts();
  }

  onRangeChange() {
    if (this.periodo !== 'rango') return;
    this.calcularMetricas();
    this.renderCharts();
  }

  onLocationChange() {
    this.calcularMetricas();
    this.renderCharts();
  }

  get hayDatos(): boolean {
    return this.turnos?.length > 0;
  }

  private setDefaultRange() {
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 29);
    this.rangeInicio = start.toISOString().split('T')[0];
    this.rangeFin = today.toISOString().split('T')[0];
  }

  /**
   * Método principal de calculo de métricas:
   * - ingresos y propinas
   * - horas y turnos
   * - métricas mensuales
   * - proyecciones
   * - comparativa histórica
   * - metas y recomendaciones
   */
  private calcularMetricas() {
    const today = new Date();
    let ingresos = 0;
    let propinas = 0;
    let cnt = 0;
    let horas = 0;
    let ingresosMesActual = 0;
    let propinasMesActual = 0;
    let horasMesActual = 0;
    let turnosMesActual = 0;

    const turnosFiltrados = this.filtrarTurnos();
    // Para métricas históricas (mejor mes, proyecciones, medias mensuales) usamos todos los turnos filtrados solo por ubicación.
    const turnosPorUbicacion = this.filtrarPorUbicacion(this.turnos);

    turnosFiltrados.forEach(t => {
      const s = Number(t.salary ?? 0);
      const tip = Number(t.tips ?? 0);
      ingresos += s; // ingresos solo con salario, sin propinas
      propinas += tip;
      horas += Number(t.hours ?? 0);
      cnt++;
    });

    this.salarioTotal = Math.round(ingresos * 100) / 100;
    this.propinasTotal = Math.round(propinas * 100) / 100;
    this.promedioPorTurno = cnt ? Math.round((ingresos / cnt) * 100) / 100 : 0;
    this.totalHoras = Math.round(horas * 100) / 100;

    const ingresosPorMes: { [mes: string]: number } = {};
    let total = 0;
    let totalTurnos = 0;

    turnosPorUbicacion.forEach(t => {
      const d = parseISO(t.date);
      if (isNaN(d.getTime())) return;
      const mes = format(d, 'yyyy-MM');
      const ingreso = Number(t.salary ?? 0); // solo salario para ingresos
      ingresosPorMes[mes] = (ingresosPorMes[mes] || 0) + ingreso;
      total += ingreso;
      totalTurnos++;

      if (isSameMonth(d, today)) {
        ingresosMesActual += ingreso;
        propinasMesActual += Number(t.tips ?? 0);
        horasMesActual += Number(t.hours ?? 0);
        turnosMesActual++;
      }
    });

    this.totalIngresos = Math.round(total * 100) / 100;

    let maxMes = '';
    let maxIngresos = 0;
    Object.keys(ingresosPorMes).forEach(m => {
      if (ingresosPorMes[m] > maxIngresos) {
        maxIngresos = ingresosPorMes[m];
        maxMes = m;
      }
    });

    this.mejorMes = maxMes;
    this.ingresosMejorMes = Math.round(maxIngresos * 100) / 100;
    this.promedioTotal = totalTurnos ? Math.round((total / totalTurnos) * 100) / 100 : 0;

    const dayOfMonth = today.getDate();
    const daysInMonth = endOfMonth(today).getDate();
    this.projectedIngresosMes = dayOfMonth ? Math.round((ingresosMesActual / dayOfMonth) * daysInMonth * 100) / 100 : 0;
    this.projectedPropinasMes = dayOfMonth ? Math.round((propinasMesActual / dayOfMonth) * daysInMonth * 100) / 100 : 0;
    this.proyeccionVsMejorMes = Math.round((this.projectedIngresosMes - this.ingresosMejorMes) * 100) / 100;

    this.ingresosMesActual = Math.round(ingresosMesActual * 100) / 100;
    this.horasMesActual = Math.round(horasMesActual * 100) / 100;
    this.turnosMesActual = turnosMesActual;
    this.mediaIngresoTurnoMes = turnosMesActual ? Math.round((ingresosMesActual / turnosMesActual) * 100) / 100 : 0;
    this.mediaHorasTurnoMes = turnosMesActual ? Math.round((horasMesActual / turnosMesActual) * 100) / 100 : 0;
    this.mediaIngresoHoraMes = horasMesActual ? Math.round((ingresosMesActual / horasMesActual) * 100) / 100 : 0;
    this.diasRestantesMes = daysInMonth - dayOfMonth;

    const gap = Math.max(0, this.ingresosMejorMes - this.ingresosMesActual);
    if (gap > 0 && this.mediaIngresoHoraMes > 0 && this.mediaHorasTurnoMes > 0) {
      const horasNecesarias = gap / this.mediaIngresoHoraMes;
      this.turnosParaIgualar = Math.ceil(horasNecesarias / this.mediaHorasTurnoMes);
      this.horasParaIgualar = Math.round(horasNecesarias * 100) / 100;
    } else {
      this.turnosParaIgualar = 0;
      this.horasParaIgualar = 0;
    }

    this.calcularMetaMensual(ingresosMesActual);
    this.calcularRecordatorio(turnosPorUbicacion);
    this.calcularPlanSemanal(turnosPorUbicacion);
  }

  /**
   * renderiza todas las gráficas activas,
   * destruye instancias previas para evitar fugas de memoria.
   * @returns 
   */
  private renderCharts() {
    if (!this.hayDatos) {
      return;
    }
    if (!this.ingresosCanvas?.nativeElement || !this.horasCanvas?.nativeElement) return;

    if (this.ingresosChart) this.ingresosChart.destroy();
    if (this.horasChart) this.horasChart.destroy();

    this.renderIngresosChart();
    this.renderHorasChart();
  }

  /**
   * gráfica de barras: ingresos por mes
   */
  private renderIngresosChart() {
    const ingresosPorMes: { [mes: string]: number } = {};
    const turnosFiltrados = this.filtrarTurnos();
    turnosFiltrados.forEach(t => {
      const d = parseISO(t.date);
      if (isNaN(d.getTime())) return;
      const mes = format(d, 'yyyy-MM');
      const ingreso = Number(t.salary ?? 0); // solo salario para ingresos
      ingresosPorMes[mes] = (ingresosPorMes[mes] || 0) + ingreso;
    });

    const labels = Object.keys(ingresosPorMes).sort();
    const data = labels.map(l => ingresosPorMes[l]);

    this.ingresosChart = new Chart(this.ingresosCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Ingresos',
          data,
          backgroundColor: 'rgba(54,162,235,0.6)',
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true }, title: { display: true, text: 'Ingresos por mes' } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  /**
   * gráfica de linea: horas trabajadas por día
   */
  private renderHorasChart() {
    const horasPorDia: { [dia: string]: number } = {};
    const turnosFiltrados = this.filtrarTurnos();

    if (this.periodo === 'semana') {
      const now = new Date();
      const inicioSemana = startOfWeek(now, { weekStartsOn: 1 });
      for (let i = 0; i < 7; i++) {
        const d = addDays(inicioSemana, i);
        horasPorDia[format(d, 'yyyy-MM-dd')] = 0;
      }
    }

    turnosFiltrados.forEach(t => {
      const d = parseISO(t.date);
      if (isNaN(d.getTime())) return;
      const key = format(d, 'yyyy-MM-dd');
      horasPorDia[key] = (horasPorDia[key] || 0) + Number(t.hours ?? 0);
    });

    const labels = Object.keys(horasPorDia).sort();
    const data = labels.map(l => Math.round((horasPorDia[l] || 0) * 100) / 100);

    this.horasChart = new Chart(this.horasCanvas.nativeElement, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Horas trabajadas',
          data,
          borderColor: 'rgba(255,99,132,0.8)',
          backgroundColor: 'rgba(255,99,132,0.2)',
          fill: true,
          tension: 0.3,
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true }, title: { display: true, text: 'Horas trabajadas' } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  /**
   * filtra turnos según:
   * - periodo seleccionado (mes, semana, rango)
   * - ubicación seleccionada
   * - rango de fechas
  
   */
  private filtrarTurnos(): Turno[] {
    if (!this.turnos?.length) return [];
    const now = new Date();
    const inicioSemana = startOfWeek(now, { weekStartsOn: 1 });
    const finSemana = endOfWeek(now, { weekStartsOn: 1 });

    return this.turnos.filter(t => {
      const d = parseISO(t.date);
      if (isNaN(d.getTime())) return false;

      if (this.selectedLocation !== 'all') {
        const loc = (t.location || '').trim();
        if (loc !== this.selectedLocation) return false;
      }

      if (this.periodo === 'mes') {
        return isSameMonth(d, now);
      }

      if (this.periodo === 'semana') {
        return d >= inicioSemana && d <= finSemana;
      }

      if (!this.rangeInicio || !this.rangeFin) return false;
      const inicio = parseISO(this.rangeInicio);
      const fin = parseISO(this.rangeFin);
      if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) return false;
      return d >= inicio && d <= fin;
    });
  }

  /**
   * Filtra únicament epor ubicación, usado para métricas históricas globales
   * @param turnos 
   * @returns 
   */
  private filtrarPorUbicacion(turnos: Turno[]): Turno[] {
    if (!turnos?.length) return [];
    return turnos.filter(t => {
      const d = parseISO(t.date);
      if (isNaN(d.getTime())) return false;
      if (this.selectedLocation !== 'all') {
        const loc = (t.location || '').trim();
        if (loc !== this.selectedLocation) return false;
      }
      return true;
    });
  }

  guardarMeta() {
    const parsed = Number(this.monthlyGoalInput);
    this.monthlyGoal = isNaN(parsed) || parsed < 0 ? 0 : Math.round(parsed * 100) / 100;
    this.monthlyGoalInput = this.monthlyGoal ? this.monthlyGoal.toString() : '';
    localStorage.setItem(this.metaStorageKey, this.monthlyGoal.toString());
    this.calcularMetricas();
  }

  private loadMonthlyGoal() {
    const raw = localStorage.getItem(this.metaStorageKey);
    if (!raw) return;
    const parsed = Number(raw);
    if (!isNaN(parsed) && parsed >= 0) {
      this.monthlyGoal = parsed;
      this.monthlyGoalInput = parsed.toString();
    }
  }
  /**
   * calcula el progreso hacia la meta mensual y estima turnos y horas necesarias para alcanzarla.
   * @param ingresosMesActual 
   * @returns 
   */
  private calcularMetaMensual(ingresosMesActual: number) {
    if (this.monthlyGoal <= 0) {
      this.goalProgress = 0;
      this.goalRemaining = 0;
      this.goalTurnosNecesarios = 0;
      this.goalHorasNecesarias = 0;
      return;
    }
    this.goalProgress = Math.max(0, Math.min(100, Math.round((ingresosMesActual / this.monthlyGoal) * 100)));
    const gapMeta = Math.max(0, this.monthlyGoal - this.projectedIngresosMes);
    if (gapMeta > 0 && this.mediaIngresoHoraMes > 0 && this.mediaHorasTurnoMes > 0) {
      const horasNecesarias = gapMeta / this.mediaIngresoHoraMes;
      this.goalHorasNecesarias = Math.round(horasNecesarias * 100) / 100;
      this.goalTurnosNecesarios = Math.ceil(horasNecesarias / this.mediaHorasTurnoMes);
      this.goalRemaining = Math.round(gapMeta * 100) / 100;
    } else {
      this.goalRemaining = 0;
      this.goalHorasNecesarias = 0;
      this.goalTurnosNecesarios = 0;
    }
  }

  /**
   * genera un recordatorio inteligente basado en rendimiento histórico del usuario
   * @param turnos 
   * @returns 
   */
  private calcularRecordatorio(turnos: Turno[]) {
    if (this.monthlyGoal <= 0 || this.projectedIngresosMes >= this.monthlyGoal || this.mediaIngresoHoraMes <= 0 || this.mediaHorasTurnoMes <= 0) {
      this.recordatorioActivo = false;
      return;
    }

    const gap = this.monthlyGoal - this.projectedIngresosMes;
    const horasNecesarias = gap / this.mediaIngresoHoraMes;
    this.recordatorioHoras = Math.round(horasNecesarias * 100) / 100;
    this.recordatorioTurnos = Math.ceil(horasNecesarias / this.mediaHorasTurnoMes);

    const hotspots = this.calcularHotspots(turnos);
    this.hotspotUbicacion = hotspots.bestLocation;
    this.hotspotFranja = hotspots.bestHourSlot;
    this.hotspotRate = hotspots.bestRate;
    this.recordatorioTextoUbicacion = hotspots.bestLocation;
    this.recordatorioTextoFranja = hotspots.bestHourSlot;
    this.recordatorioIngresoHoraRef = hotspots.bestRate;

    this.recordatorioActivo = true;
  }

  /**
   * detecta "hotspot":
   * - mejor ubicación histórica
   * - mejor franja horaria histórica
   * - mejor radio €/h histórico
   * @param turnos 
   * @returns 
   */
  private calcularHotspots(turnos: Turno[]) {
    const locStats: Record<string, { ingreso: number; horas: number }> = {};
    const hourStats: Record<string, { ingreso: number; horas: number }> = {};

    turnos.forEach(t => {
      const horas = Number(t.hours ?? 0);
      const ingreso = Number(t.salary ?? 0);
      if (isNaN(horas) || horas <= 0 || isNaN(ingreso)) return;

      const loc = (t.location || 'General').trim() || 'General';
      locStats[loc] = locStats[loc] || { ingreso: 0, horas: 0 };
      locStats[loc].ingreso += ingreso;
      locStats[loc].horas += horas;

      const start = (t.startTime || '').trim();
      const hour = start ? Number(start.split(':')[0]) : NaN;
      const bucketHour = isNaN(hour) ? 'Horario' : hour.toString().padStart(2, '0');
      const bucketLabel = `${bucketHour}:00-${bucketHour}:59`;
      hourStats[bucketLabel] = hourStats[bucketLabel] || { ingreso: 0, horas: 0 };
      hourStats[bucketLabel].ingreso += ingreso;
      hourStats[bucketLabel].horas += horas;
    });

    let bestLocation = '';
    let bestRate = 0;
    Object.keys(locStats).forEach(loc => {
      const h = locStats[loc].horas;
      if (h <= 0) return;
      const rate = locStats[loc].ingreso / h;
      if (rate > bestRate) {
        bestRate = rate;
        bestLocation = loc;
      }
    });

    let bestHourSlot = '';
    let bestHourRate = 0;
    Object.keys(hourStats).forEach(slot => {
      const h = hourStats[slot].horas;
      if (h <= 0) return;
      const rate = hourStats[slot].ingreso / h;
      if (rate > bestHourRate) {
        bestHourRate = rate;
        bestHourSlot = slot;
      }
    });

    // Si no hay datos de hora, usa ubicación; si no hay nada, valores genéricos
    const fallbackRate = bestRate || bestHourRate || this.mediaIngresoHoraMes;
    return {
      bestLocation: bestLocation || 'Mejor ubicacion historica',
      bestHourSlot: bestHourSlot || 'Franja con mejor €/h',
      bestRate: Math.round((fallbackRate || 0) * 100) / 100
    };
  }

  /**
   * genera un plan automático semanal para alcanzar la meta mensual
   * @param turnos 
   * @returns 
   */
  private calcularPlanSemanal(turnos: Turno[]) {
    this.weeklyPlan = [];
    this.weeklyPlanActivo = false;
    this.weeklyPlanTurnosNecesarios = 0;
    this.weeklyPlanHorasNecesarias = 0;

    if (this.monthlyGoal <= 0 || this.mediaIngresoHoraMes <= 0 || this.mediaHorasTurnoMes <= 0) return;

    const gap = this.monthlyGoal - this.projectedIngresosMes;
    if (gap <= 0) return;

    const horasNecesarias = gap / this.mediaIngresoHoraMes;
    const turnosNecesarios = Math.ceil(horasNecesarias / this.mediaHorasTurnoMes);
    this.weeklyPlanHorasNecesarias = Math.round(horasNecesarias * 100) / 100;
    this.weeklyPlanTurnosNecesarios = turnosNecesarios;

    const today = new Date();
    const finSemana = endOfWeek(today, { weekStartsOn: 1 });
    const diasRestantes: Date[] = [];
    let cursor = new Date(today);
    while (cursor <= finSemana) {
      diasRestantes.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    if (!diasRestantes.length) return;

    let turnosPendientes = turnosNecesarios;
    let horasPendientes = horasNecesarias;
    const loc = this.hotspotUbicacion || 'Ubicacion sugerida';
    const franja = this.hotspotFranja || 'Franja sugerida';
    const rate = this.hotspotRate || this.mediaIngresoHoraMes;

    diasRestantes.forEach((day, idx) => {
      if (turnosPendientes <= 0 || horasPendientes <= 0) return;
      const slotsRestantes = diasRestantes.length - idx;
      const turnosDia = Math.max(0, Math.ceil(turnosPendientes / slotsRestantes));
      const horasDia = Math.min(horasPendientes, turnosDia * this.mediaHorasTurnoMes);

      this.weeklyPlan.push({
        fecha: format(day, 'EEE dd/MM'),
        turnos: turnosDia,
        horas: Math.round(horasDia * 100) / 100,
        ubicacion: loc,
        franja: franja,
        rate: Math.round(rate * 100) / 100
      });

      turnosPendientes -= turnosDia;
      horasPendientes = Math.max(0, horasPendientes - horasDia);
    });

    if (this.weeklyPlan.length) {
      this.weeklyPlanActivo = true;
    }
  }
  /**
   * extrae ubicaciones úncias de los turnos para el filtro de ubicación
   */
  private updateLocations() {
    const unique = new Set<string>();
    this.turnos.forEach(t => {
      const loc = (t.location || '').trim();
      if (loc) unique.add(loc);
    });
    this.locations = Array.from(unique).sort();
    if (this.selectedLocation !== 'all' && !unique.has(this.selectedLocation)) {
      this.selectedLocation = 'all';
    }
  }

}
