
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ModalController } from '@ionic/angular';

import { TurnosPage } from './turnos.page';
import { TurnosPageModule } from './turnos.module';

describe('TurnosPage', () => {
  let component: TurnosPage;
  let fixture: ComponentFixture<TurnosPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TurnosPageModule, RouterTestingModule],
      providers: [
        {
          provide: ModalController,
          useValue: {
            create: () => Promise.resolve({
              present: () => Promise.resolve(),
              dismiss: () => Promise.resolve()
            })
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TurnosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
