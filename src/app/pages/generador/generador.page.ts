import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { OcrService } from 'src/app/services/ocr.service';
import { AuthService } from 'src/app/services/auth.service';
import { FirebaseService } from 'src/app/services/firebase.service';
import { TurnoService } from 'src/app/services/turno.service';
import { Turno } from 'src/app/model/turno.model';
import { ScheduleImportService } from 'src/app/services/schedule-import.service';

interface DetectedTurn {
  date: string;
  startTime: string;
}

@Component({
  selector: 'app-generador',
  templateUrl: './generador.page.html',
  standalone:false,
  styleUrls: ['./generador.page.scss'],
})
export class GeneradorPage implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  loading = false;
  aliases: string[] = [];
  aliasInput = '';
  imagePreviewUrl = '';
  turns: DetectedTurn[] = [];
  errorMessage = '';
  ocrText = '';

  private userId: string | null = null;

  constructor(
    private authService: AuthService,
    private firebaseService: FirebaseService,
    private turnoService: TurnoService,
    private toastController: ToastController,
    private ocrService: OcrService,
    private scheduleImportService: ScheduleImportService
  ) {}

  async ngOnInit() {
    await this.loadAliases();
  }

  private async loadAliases() {
    const user = await firstValueFrom(
      this.authService.CurrentAppUser.pipe(take(1))
    );
    if (!user) {
      this.errorMessage = 'Necesitas iniciar sesión.';
      return;
    }

    this.userId = user.id;
    const snap = await getDoc(doc(this.firebaseService.firestore, 'users', user.id));
    this.aliases = (snap.data()?.['aliases'] ?? [user.name]).filter(Boolean);
  }

  addAlias() {
    const v = this.aliasInput.trim();
    if (v && !this.aliases.includes(v)) this.aliases.push(v);
    this.aliasInput = '';
  }

  removeAlias(i: number) {
    this.aliases.splice(i, 1);
  }

  async saveAliases() {
    if (!this.userId) return;
    await setDoc(
      doc(this.firebaseService.firestore, 'users', this.userId),
      { aliases: this.aliases },
      { merge: true }
    );
  }

  pickImage() {
    this.fileInput.nativeElement.click();
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.loading = true;
    this.turns = [];
    this.errorMessage = '';

    try {
      if (this.imagePreviewUrl) URL.revokeObjectURL(this.imagePreviewUrl);
      this.imagePreviewUrl = URL.createObjectURL(file);

      const ocr = await this.ocrService.readTextFromImage(file);
      this.ocrText = ocr.text;

     console.log('OCR TEXT:', ocr.text);
console.log('OCR WORDS COUNT:', ocr.words.length);

     this.turns = this.scheduleImportService.parseScheduleFromWords(ocr.words, this.aliases);

      console.log('DETECTED TURNS:', this.turns);
    } catch (e: any) {
      this.errorMessage = e?.message ?? 'Error leyendo el cuadrante';
    } finally {
      this.loading = false;
      input.value = '';
    }
  }

  removeTurn(i: number) {
    this.turns.splice(i, 1);
  }

  async saveTurns() {
    if (!this.userId || !this.turns.length) return;

    const now = new Date().toISOString();

    await Promise.all(
      this.turns.map((t, i) =>
        this.turnoService.addTurnoFuturo({
          id: `${Date.now()}-${i}`,
          userId: this.userId!,
          date: t.date,
          startTime: t.startTime,
          endTime: t.startTime,
          hours: 0,
          salary: 0,
          tips: 0,
          location: '',
          notes: 'Importado desde cuadrante',
          breakTime: 0,
          status: 'scheduled',
          createdAt: now,
          updatedAt: now,
        } as Turno)
      )
    );

    this.turns = [];
    this.imagePreviewUrl = '';
    this.showToast('Turnos importados correctamente');
  }

  private async showToast(msg: string) {
    const toast = await this.toastController.create({
      message: msg,
      duration: 2000,
      position: 'bottom',
    });
    await toast.present();
  }
}
