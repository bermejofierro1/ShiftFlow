import { FormBuilder } from '@angular/forms';

import { TurnoModalComponent } from './turno-modal.component';

describe('TurnoModalComponent (horas y salario)', () => {
  const fb = new FormBuilder();
  const turnoServiceMock: any = { addTurno: jasmine.createSpy('addTurno') };
  const authServiceMock: any = { CurrentAppUser: { pipe: () => ({ toPromise: () => Promise.resolve(null) }) } };
  const modalControllerMock: any = { dismiss: jasmine.createSpy('dismiss').and.resolveTo(true) };
  const userServiceMock: any = { getUser: jasmine.createSpy('getUser') };

  let component: TurnoModalComponent;

  beforeEach(() => {
    component = new TurnoModalComponent(
      fb,
      turnoServiceMock,
      authServiceMock,
      modalControllerMock,
      userServiceMock
    );
  });

  it('calcula horas en el mismo dia', () => {
    const hours = (component as any).calculateHours('2024-01-01', '08:00', '12:30', 30);
    expect(hours).toBe(4);
  });

  it('calcula horas cruzando medianoche', () => {
    const hours = (component as any).calculateHours('2024-01-01', '22:00', '02:30', 0);
    expect(hours).toBe(4.5);
  });

  it('no devuelve negativo cuando el break es mayor a la duracion', () => {
    const hours = (component as any).calculateHours('2024-01-01', '10:00', '11:00', 90);
    expect(hours).toBe(0);
  });
});
