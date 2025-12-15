import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TurnosPage } from './turnos.page';

const routes: Routes = [
  {
    path: '',
    component: TurnosPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TurnosPageRoutingModule {}
