import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';
import { TurnoService } from 'src/app/services/turno.service';
import { User } from 'src/app/model/user.model';

@Component({
  selector: 'app-ajustes',
  templateUrl: './ajustes.page.html',
  standalone: false,
  styleUrls: ['./ajustes.page.scss'],
})
export class AjustesPage implements OnInit, OnDestroy {
  user: User | null = null;
  pendingWritesCount = 0;

  private authSubscription!: Subscription;
  private pendingWritesSubscription!: Subscription;

  constructor(
    private router: Router,
    private authService: AuthService,
    private turnoService: TurnoService
  ) {}

  ngOnInit() {
    this.authSubscription = this.authService.CurrentAppUser.subscribe((user) => {
      this.user = user;
    });

    this.pendingWritesSubscription = this.turnoService.getPendingWritesObservable().subscribe((count) => {
      this.pendingWritesCount = count;
    });
  }

  openNotifications() {
    this.router.navigate(['/tabs/notificaciones']);
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    if (this.pendingWritesSubscription) {
      this.pendingWritesSubscription.unsubscribe();
    }
  }
}
