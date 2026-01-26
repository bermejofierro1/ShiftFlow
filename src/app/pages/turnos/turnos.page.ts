import { Component, OnDestroy, OnInit } from '@angular/core';
import { Turno } from 'src/app/model/turno.model';
import { TurnoService } from 'src/app/services/turno.service';
import { parseISO, format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, isSameMonth } from 'date-fns'
import jsPDF from 'jspdf';
import { AlertController, ModalController } from '@ionic/angular';
import { TurnoModalComponent } from 'src/app/components/turno-modal/turno-modal.component';
import { AuthService } from 'src/app/services/auth.service';
import { filter, Subscription, take } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { ToastController } from '@ionic/angular';

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
  turnosUsuario: Turno[] = [];
  loading = false;
  pendingWritesCount = 0;

  currentMonth = new Date();
  calendarDays: { date: Date; inMonth: boolean; count: number }[] = [];
  calendarMonthLabel = '';
  weekdays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  selectedDateKey: string | null = null;
  selectedDayTurnos: Turno[] = [];

  //suscripción al usuario autenticado
  private authSubscription!: Subscription;
  //suscripción a los turnos en tiempo real
  private turnosSubscription!: Subscription;
  private pendingWritesSubscription!: Subscription;

  constructor(
    private turnoService: TurnoService,
    private modalController: ModalController,
    private authService: AuthService,
    private alertController: AlertController,
      private toastController: ToastController
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
          this.subscribeToPendingWrites();
        } else {
          this.userIdActual = null;
          this.turnosPorSemana = [];
          this.pendingWritesCount = 0;
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
    this.turnosUsuario = turnosUsuario;
    this.buildCalendar();
        this.clearSelectedDayIfNeeded();

        this.loading = false;
      },
      (error) => {
        console.error('Error en suscripción de turnos:', error);
        this.loading = false;
      }
    );
  }

  private subscribeToPendingWrites() {
    if (this.pendingWritesSubscription) {
      this.pendingWritesSubscription.unsubscribe();
    }

    this.pendingWritesSubscription = this.turnoService.getPendingWritesObservable().subscribe(
      (count) => {
        this.pendingWritesCount = count;
      },
      (error) => {
        console.error('Error en suscripciИn de pendientes:', error);
        this.pendingWritesCount = 0;
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

  private buildTurnoCountByDate(): Record<string, number> {
    const map: Record<string, number> = {};
    for (const turno of this.turnosUsuario) {
      if (!turno.date) continue;
      map[turno.date] = (map[turno.date] ?? 0) + 1;
    }
    return map;
  }

  private buildCalendar() {
    const start = startOfWeek(startOfMonth(this.currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(this.currentMonth), { weekStartsOn: 1 });
    const counts = this.buildTurnoCountByDate();
    const days: { date: Date; inMonth: boolean; count: number }[] = [];

    let day = start;
    while (day <= end) {
      const key = format(day, 'yyyy-MM-dd');
      days.push({
        date: day,
        inMonth: isSameMonth(day, this.currentMonth),
        count: counts[key] ?? 0
      });
      day = addDays(day, 1);
    }

    this.calendarDays = days;
    this.calendarMonthLabel = format(this.currentMonth, 'MMMM yyyy');
  }

  previousMonth() {
    this.currentMonth = addMonths(this.currentMonth, -1);
    this.buildCalendar();
    this.clearSelectedDay();
  }

  nextMonth() {
    this.currentMonth = addMonths(this.currentMonth, 1);
    this.buildCalendar();
    this.clearSelectedDay();
  }

  selectDay(day: { date: Date; inMonth: boolean }) {
    if (!day.inMonth) return;
    const key = format(day.date, 'yyyy-MM-dd');
    this.selectedDateKey = key;
    this.selectedDayTurnos = this.turnosUsuario
      .filter((t) => t.date === key)
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  }

  clearSelectedDay() {
    this.selectedDateKey = null;
    this.selectedDayTurnos = [];
  }

  private clearSelectedDayIfNeeded() {
    if (!this.selectedDateKey) return;
    const hasTurnos = this.turnosUsuario.some((t) => t.date === this.selectedDateKey);
    if (!hasTurnos) {
      this.clearSelectedDay();
    }
  }

  /**
   * formatea una fecha para mostrar en la UI
   * @param date 
   * @returns 
   */
  formatDate(date: string): string {
    return format(parseISO(date), 'eee, dd MMM');
  }

  formatDateKey(date: Date): string {
    return format(date, 'yyyy-MM-dd');
  }

async exportTurnosPdf() {
  try {
    console.error('SHIFTLOW_EXPORT: CLICK DETECTED');
    console.log('SHIFTLOW_EXPORT: PLATFORM', Capacitor.getPlatform(), 'isNative', Capacitor.isNativePlatform());

    const toast = await this.toastController.create({
      message: 'Exportar: click detectado ✅',
      duration: 900,
      position: 'bottom',
    });
    await toast.present();

    if (!this.turnosUsuario || this.turnosUsuario.length === 0) {
      const alert = await this.alertController.create({
        header: 'Sin turnos',
        message: 'No hay turnos realizados para exportar.',
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }

    const rows = [...this.turnosUsuario].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    console.error('SHIFTLOW_EXPORT: rows length =>', rows.length);

    // Helpers de formato (ES)
    const fmtMoney = (n: number) =>
      new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' EUR';
    const fmtNum = (n: number) =>
      new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

    // ✅ 1) Crear PDF
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;

    const totalHoras = rows.reduce((acc, r) => acc + (r.hours || 0), 0);
    const totalSalario = rows.reduce((acc, r) => acc + (r.salary || 0), 0);
    const totalPropinas = rows.reduce((acc, r) => acc + (r.tips || 0), 0);
    const total = totalSalario + totalPropinas;
    const media = rows.length ? total / rows.length : 0;

    // Header
    doc.setFillColor(102, 126, 234);
    doc.rect(0, 0, pageWidth, 70, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('Turnos realizados', margin, 45);

    doc.setFontSize(10);
    doc.text(format(new Date(), 'dd/MM/yyyy'), pageWidth - margin, 45, { align: 'right' });

    // Summary
    let y = 90;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);

    doc.text(`Total turnos: ${rows.length}`, margin, y);
    doc.text(`Horas: ${fmtNum(totalHoras)}`, margin + 160, y);
    doc.text(`Salario: ${fmtMoney(totalSalario)}`, margin + 300, y);

    y += 18;
    doc.text(`Propinas: ${fmtMoney(totalPropinas)}`, margin, y);
    doc.text(`Total: ${fmtMoney(total)}`, margin + 160, y);
    doc.text(`Media/turno: ${fmtMoney(media)}`, margin + 300, y);

    // Tabla
    y += 28;
    const tableWidth = pageWidth - margin * 2;

    // Más espacio para dinero y total
    const colWidths = [78, 55, 55, 48, 78, 78, 78]; // suma = 470 (cuadra con A4 y margin=40)
    const headers = ['Fecha', 'Inicio', 'Fin', 'Horas', 'Salario', 'Propinas', 'Total'];

    const aligns: Array<'left' | 'right'> = ['left', 'left', 'left', 'right', 'right', 'right', 'right'];
    const padLeft = 6;
    const padRight = 6;

    const drawHeaderRow = () => {
      doc.setFillColor(239, 242, 255);
      doc.rect(margin, y - 12, tableWidth, 22, 'F');

      doc.setTextColor(51, 65, 85);
      doc.setFontSize(10);

      let x = margin;
      headers.forEach((h, i) => {
        const w = colWidths[i];
        if (aligns[i] === 'right') {
          doc.text(h, x + w - padRight, y + 4, { align: 'right' });
        } else {
          doc.text(h, x + padLeft, y + 4);
        }
        x += w;
      });

      y += 18;
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(9);
    };

    drawHeaderRow();

    const rowHeight = 18;

    for (const turno of rows) {
      if (y + rowHeight > pageHeight - margin) {
        doc.addPage();
        y = margin + 20;
        drawHeaderRow();
      }

      const dateLabel = turno.date ? format(parseISO(turno.date), 'dd/MM/yyyy') : '';
      const totalRow = (turno.salary || 0) + (turno.tips || 0);

      const values = [
        dateLabel,
        turno.startTime || '',
        turno.endTime || '',
        fmtNum(turno.hours ?? 0),
        fmtMoney(turno.salary ?? 0),
        fmtMoney(turno.tips ?? 0),
        fmtMoney(totalRow),
      ];

      let x = margin;
      values.forEach((v, i) => {
        const w = colWidths[i];
        const text = String(v);

        if (aligns[i] === 'right') {
          doc.text(text, x + w - padRight, y + 2, { align: 'right' });
        } else {
          doc.text(text, x + padLeft, y + 2);
        }
        x += w;
      });

      y += rowHeight;
    }

    // ✅ 2) Guardar / compartir
    const fileName = `turnos-realizados-${Date.now()}.pdf`;

    // Web
    if (!Capacitor.isNativePlatform()) {
      doc.save(fileName);
      return;
    }

    // Android/iOS
    const pdfBlob = doc.output('blob');
    const base64 = await this.blobToBase64(pdfBlob);

    let saved;
    try {
      saved = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Documents,
        recursive: true,
      });
    } catch (e) {
      console.error('SHIFTLOW_EXPORT: write Documents failed, fallback to Cache', e);
      saved = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
        recursive: true,
      });
    }

    console.error('SHIFTLOW_EXPORT: SAVED URI =>', saved.uri);

    const can = await Share.canShare();
    if (!can.value) {
      const t2 = await this.toastController.create({
        message: 'PDF guardado, pero no se puede abrir el selector de compartir en este dispositivo.',
        duration: 2500,
        position: 'bottom',
      });
      await t2.present();
      return;
    }

    await Share.share({
      title: 'Turnos realizados',
      text: 'PDF exportado desde ShiftFlow',
      url: saved.uri,
      dialogTitle: 'Compartir PDF',
    });

  } catch (e: any) {
    console.error('SHIFTLOW_EXPORT: EXPORT ERROR =>', e);

    const tErr = await this.toastController.create({
      message: `Error exportando PDF: ${e?.message ?? e}`,
      duration: 3000,
      position: 'bottom',
    });
    await tErr.present();
  }
}



// Déjalo dentro de la clase TurnosPage
private blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const res = String(reader.result || '');
      resolve(res.split(',')[1] || '');
    };
    reader.readAsDataURL(blob);
  });
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
    if (this.pendingWritesSubscription) {
      this.pendingWritesSubscription.unsubscribe();
    }
  }
}
