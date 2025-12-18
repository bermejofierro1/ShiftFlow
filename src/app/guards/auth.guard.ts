import { Injectable } from '@angular/core';
import { CanActivate, CanMatch, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';

import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate, CanMatch {
  constructor(private authService: AuthService, private router: Router) {}

  private checkAuth(): Observable<boolean | UrlTree> {
    return this.authService.CurrentAppUser.pipe(
      take(1),
      map((user) => user ? true : this.router.createUrlTree(['/login']))
    );
  }

  canActivate(): Observable<boolean | UrlTree> {
    return this.checkAuth();
  }

  canMatch(): Observable<boolean | UrlTree> {
    return this.checkAuth();
  }
}
