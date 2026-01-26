import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

import { Turno } from 'src/app/model/turno.model';
import { AuthService } from 'src/app/services/auth.service';
import { TurnoService } from 'src/app/services/turno.service';
import { UserService } from 'src/app/services/user.service';

/**
 * Componente modal encarga de la creación y edición de los turnos.
 * Permite:
 * - crear nuevos turnos asociados al usuario conectado
 * - editar turnos creados
 * - calcular automáticamente horas trabajadas, salario y ganancias totales
 * - validar tarifas personalizadas por turno
 * 
 * Se ha implementado como componente standlone para mejorar la modularidad y facilitar su reutilización.
 */
@Component({
  selector: 'app-turno-modal',
  templateUrl: './turno-modal.component.html',
  standalone: true,
  styleUrls: ['./turno-modal.component.scss'],
  imports: [IonicModule, CommonModule, FormsModule, ReactiveFormsModule]
})
export class TurnoModalComponent implements OnInit {

  //ID del usuario al que se asociará el turno
  @Input() userId!: string;
  //turno a editar (si se está en modo edición)
  @Input() turno?: Turno;
  @Input() initialTurno?: Partial<Turno>;
  //indica si el modal está en modo edición o creación
  @Input() modoEdicion = false;

  //Formulario reactivo para gestionar los datos del turno
  turnoForm!: FormGroup;
  //control de estado de carga para UX
  loading = false;
  //mensaje de error para mostrar en la UI
  errorMessage: string | null = null;
  //tarifa horaria predeterminada del usuario conectado
  userHourlyRate = 0;
  //id del usuario conectado
  private currentUserId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private turnoService: TurnoService,
    private authService: AuthService,
    private modalController: ModalController,
    private userService: UserService
  ) { }

  async ngOnInit() {
    console.log('TurnoModalComponent ngOnInit');
    //inicia el formulario 
    this.initializeForm();

    //oobtiene el usuario conectado
    const currentUser = await firstValueFrom(this.authService.CurrentAppUser.pipe(take(1)));
    this.currentUserId = currentUser?.id ?? null;

    //verifica que el turno solo se gestione por el usuario conectado
    if (!this.userId || !this.currentUserId || this.userId !== this.currentUserId) {
      await this.handleMissingUser();
      return;
    }

    //carga la tarifa por hora dle usuario
    try {
      const user = await this.userService.getUser(this.userId);
      if (!user || !user.hourlyRate) {
        await this.handleMissingUser();
        return;
      }

      this.userHourlyRate = user.hourlyRate;
    } catch (error) {
      console.error('Error cargando hourlyRate del usuario:', error);
      await this.handleMissingUser();
      return;
    }

    //configura validaciones dinámicas para tarifa personalizada
    this.setupCustomRateValidation();
    //si es edición, carga los datos del turno en el formulario
    if (this.modoEdicion && this.turno) {
      this.cargarTurnoEnFormulario(this.turno);
    } else if (this.initialTurno) {
      this.turnoForm.patchValue({
        date: this.initialTurno.date ?? '',
        startTime: this.initialTurno.startTime ?? '08:00',
        endTime: this.initialTurno.endTime ?? this.initialTurno.startTime ?? '17:00',
        tips: this.initialTurno.tips ?? 0,
        location: this.initialTurno.location ?? '',
        notes: this.initialTurno.notes ?? '',
        breakTime: this.initialTurno.breakTime ?? 0,
        status: this.initialTurno.status ?? 'completed'
      });
    } else {
      //en creación, estbalece la fecha de hoy por defecto
      const today = new Date().toISOString().split('T')[0];
      this.turnoForm.patchValue({ date: today });
    }
  }

  /**
   * inicia el formulario con validaciones básicas y valores por defecto
   */
  initializeForm() {
    this.turnoForm = this.fb.group({
      date: ['', Validators.required],
      startTime: ['08:00', Validators.required],
      endTime: ['17:00', Validators.required],
      tips: [0, [Validators.required, Validators.min(0)]],
      location: [''],
      notes: [''],
      breakTime: [0, [Validators.min(0)]],
      status: ['scheduled', Validators.required],
      isCustomRate: [false],
      customHourlyRate: [0, [Validators.min(0)]]
    });
  }

  /**
   * Guarda el turno actual validando permisos y formulario,
   * calculando las horas y el salario,
   * difereniando entre creación y edición,
   * controla estados de carga y errores.
   * @returns 
   */
  async guardarTurno() {
    console.log('guardarTurno llamado');

    if (!this.userId || !this.currentUserId || this.userId !== this.currentUserId) {
      this.errorMessage = 'No se recibio userId';
      await this.handleMissingUser();
      return;
    }

    if (this.turnoForm.invalid) {
      return;
    }

    if (!this.userHourlyRate) {
      await this.handleMissingUser();
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    try {
      const { date, startTime, endTime, tips, location, notes, breakTime, status, isCustomRate, customHourlyRate } = this.turnoForm.value;

      const hours = this.calculateHours(date, startTime, endTime, breakTime);
      if (hours < 0) throw new Error('El tiempo de descanso no puede ser mayor que la duracion del turno');

      const calculatedSalary = this.calculatedSalary;

      if (this.modoEdicion && this.turno?.id) {
        const updateData: Partial<Turno> = {
          date,
          startTime,
          endTime,
          hours: Math.max(0, hours),
          salary: calculatedSalary,
          tips,
          location,
          notes,
          breakTime,
          status,
          customHourlyRate: isCustomRate ? customHourlyRate : null
        };
        await this.turnoService.updateTurno(this.userId, this.turno.id, updateData);
        this.modalController.dismiss({ success: true, updated: true });
      } else {
        const nuevoTurno: Turno = {
          id: Date.now().toString(),
          userId: this.userId,
          date,
          startTime,
          endTime,
          hours: Math.max(0, hours),
          salary: calculatedSalary,
          tips,
          location,
          notes,
          breakTime,
          status,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          customHourlyRate: isCustomRate ? customHourlyRate : null
        };

        console.log('Guardando turno:', nuevoTurno);
        await this.turnoService.addTurno(nuevoTurno);
        await this.updateUserStartDateIfNeeded(nuevoTurno.date);
        this.modalController.dismiss({ success: true });
      }

    } catch (error: any) {
      console.error('Error:', error);
      this.errorMessage = error.message || 'Error al crear turno';
    } finally {
      this.loading = false;
    }
  }

  get showSummary(): boolean {
    const dateValid = this.turnoForm.get('date')?.valid ?? false;
    const startTimeValid = this.turnoForm.get('startTime')?.valid ?? false;
    const endTimeValid = this.turnoForm.get('endTime')?.valid ?? false;

    return dateValid && startTimeValid && endTimeValid;
  }

  /**
   * Horas calculadas en tiempo real a partir del formulario
   */
  get calculatedHours(): number {
    const date = this.turnoForm.get('date')?.value || '1970-01-01';
    const startTime = this.turnoForm.get('startTime')?.value;
    const endTime = this.turnoForm.get('endTime')?.value;
    const breakTime = this.turnoForm.get('breakTime')?.value || 0;

    if (!startTime || !endTime) return 0;
    return this.calculateHours(date, startTime, endTime, breakTime);
  }

  /**
   * Horas calculadas en tiempo real a partir del formulario
   */
  get calculatedSalary(): number {
    const hours = this.calculatedHours;
    const isCustom = this.turnoForm.get('isCustomRate')?.value;
    const customRate = this.turnoForm.get('customHourlyRate')?.value;
    const rate = isCustom && customRate > 0 ? customRate : this.userHourlyRate;
    return Math.round(hours * rate * 100) / 100;
  }

  /**
   * salario calculado según tarifa estandar o personalizada
   */
  get totalIncome(): number {
    const salary = this.calculatedSalary;
    const tips = this.turnoForm.get('tips')?.value || 0;
    return Math.round((salary + tips) * 100) / 100;
  }

  /**
   * 
   * calcula las horas trabajadas teniendo en cuenta:
   * - turnos que cruzan la media noche,
   * - tiempo de descanso en minutos
   * - redondea a 2 decimales
   
   * @param date Fecha del turno en formato YYYY--MM-DD
   * @param startTime Hora de inicio del turno
   * @param endTime Hora de fin del turno
   * @param breakTime Tiempo de descanso en minutos
   * @returns númeor total de horas trabjadas
   */
  private calculateHours(date: string, startTime: string, endTime: string, breakTime: number): number {
    //se parsea la fecha y hora para crear objetos Date
    const [year, month, day] = date.split('-').map(Number);
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const start = new Date(year, month - 1, day, startHour, startMinute, 0, 0);
    const end = new Date(year, month - 1, day, endHour, endMinute, 0, 0);

    if (end <= start) {
      end.setDate(end.getDate() + 1);
    }

    const diffMs = end.getTime() - start.getTime();
    const hours = diffMs / (1000 * 60 * 60);
    const breakHours = (breakTime || 0) / 60;
    return Math.max(0, Math.round((hours - breakHours) * 100) / 100);
  }

  /**
   * COnfigura de forma dinamica las validaciones del campo 'customHourlyRate' en funcion del estado del checkbox 'isCustomRate'.
   * 
   * @returns 
   */
  private setupCustomRateValidation() {
    const isCustomControl = this.turnoForm.get('isCustomRate');
    const customRateControl = this.turnoForm.get('customHourlyRate');
    if (!isCustomControl || !customRateControl) return;

    const updateValidators = (isCustom: boolean) => {
      if (isCustom) {
        customRateControl.setValidators([Validators.required, Validators.min(0.01)]);
      } else {
        customRateControl.clearValidators();
        customRateControl.setValue(0);
      }
      customRateControl.updateValueAndValidity({ emitEvent: false });
    };

    updateValidators(isCustomControl.value);
    isCustomControl.valueChanges.subscribe((isCustom: boolean) => updateValidators(isCustom));
  }

  /**
   * cargar los datos de un turnos existente en el formulario cuando el modal se abre en modo edición
   * @param turno 
   */
  private cargarTurnoEnFormulario(turno: Turno) {
    const derivedRate = turno.hours > 0 ? turno.salary / turno.hours : this.userHourlyRate;
    const hasCustom = !!turno.customHourlyRate && turno.customHourlyRate > 0;
    const isCustomRate = hasCustom || Math.abs(derivedRate - this.userHourlyRate) > 0.01;
    const customRateValue = hasCustom ? turno.customHourlyRate : derivedRate;

    this.turnoForm.patchValue({
      date: turno.date,
      startTime: turno.startTime,
      endTime: turno.endTime,
      tips: turno.tips,
      location: turno.location,
      notes: turno.notes,
      breakTime: turno.breakTime || 0,
      status: turno.status,
      isCustomRate: isCustomRate,
      customHourlyRate: isCustomRate ? Math.round((customRateValue || 0) * 100) / 100 : 0
    });
    this.setupCustomRateValidation();
  }

  /**
   * actualiza la fecha de iniciodel usuario si el turno creado es anterior a la fecha actualmente registrada.
   * @param newTurnoDate 
   * @returns 
   */
  private async updateUserStartDateIfNeeded(newTurnoDate: string) {
    if (!this.userId) return;

    try {
      const user = await this.userService.getUser(this.userId);
      if (!user) return;

      const userStartDate = user.startDate ? new Date(user.startDate) : null;
      const turnoDate = new Date(newTurnoDate);

      if (!userStartDate || turnoDate < userStartDate) {
        await this.userService.updateStartDate(this.userId, turnoDate.toISOString());
        console.log('startDate actualizado a:', turnoDate.toISOString());
      }
    } catch (error) {
      console.error('Error actualizando startDate del usuario:', error);
    }
  }

  /**
   * manjea estado invalidos de usuario:
   * - cierr sesión
   * - cierra el modal
   * - fuerza a iniciar sesión
   */
  private async handleMissingUser() {
    this.errorMessage = 'Necesitas iniciar sesion para crear un turno.';
    this.loading = false;
    try {
      await this.authService.logout();
    } catch (err) {
      console.error('Error cerrando sesion:', err);
    }
    await this.modalController.dismiss({ requireLogin: true });
  }

  cancelar() {
    console.log('cancelar llamado');
    this.modalController.dismiss();
  }
}
