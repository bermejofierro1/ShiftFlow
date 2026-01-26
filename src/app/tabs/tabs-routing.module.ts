import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';
import { AuthGuard } from '../guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    canMatch: [AuthGuard],
    component: TabsPage,
    children: [
      {
        path: 'home',
        loadChildren: () => import('../pages/home/home.module').then( m => m.HomePageModule)
      },
      {
        path: 'turnos',
        loadChildren: () => import('../pages/turnos/turnos.module').then( m => m.TurnosPageModule)
      },
      {
        path: 'stats',
        loadChildren: () => import('../pages/stats/stats.module').then( m => m.StatsPageModule)
      },
      {
        path: 'perfil',
        loadChildren: () => import('../pages/perfil/perfil.module').then( m => m.PerfilPageModule)
      },
      {
        path: 'ajustes',
        loadChildren: () => import('../pages/ajustes/ajustes.module').then( m => m.AjustesPageModule)
      },
      {
        path: 'notificaciones',
        loadChildren: () => import('../pages/notificaciones/notificaciones.module').then( m => m.NotificacionesPageModule)
      },
      {
        path: 'generador',
        loadChildren: () => import('../pages/generador/generador.module').then( m => m.GeneradorPageModule)
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class TabsPageRoutingModule {}

