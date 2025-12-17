# 🚀 ShiftFlow

### Gestión de turnos, ingresos y analítica laboral  
**Ionic · Angular · Firebase**

![Ionic](https://img.shields.io/badge/Ionic-Framework-blue)
![Angular](https://img.shields.io/badge/Angular-Frontend-red)
![Firebase](https://img.shields.io/badge/Firebase-Backend-orange)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)

---

## 📌 Descripción

**ShiftFlow** es una aplicación móvil para **registrar turnos de trabajo**, calcular **ingresos reales** y analizar el rendimiento laboral mediante **estadísticas avanzadas y visualizaciones**.

El proyecto está enfocado a trabajadores por turnos (hostelería, eventos, retail) y ha sido desarrollado como **proyecto de portfolio**, priorizando arquitectura, lógica de negocio y experiencia de usuario.

---

## 📱 Capturas de la aplicación

### 🔐 Autenticación
<p align="center">
  <img src="https://github.com/user-attachments/assets/31921dfa-b152-49cb-b987-d9da9025ce41" width="220" />
  <img src="https://github.com/user-attachments/assets/130ea18b-9023-42d5-9401-676d78b492bb" width="220" />
</p>


### 🏠 Dashboard
<p align="center">
  <img src="https://github.com/user-attachments/assets/ab1e53a3-cffa-453b-8fb8-2eb46bcbb028" width="260" />
</p>


### 🕒 Gestión de turnos
<p align="center">
  <img src="https://github.com/user-attachments/assets/68266274-baa7-498c-8a37-31a62a350cc7" width="260" />
  <img src="https://github.com/user-attachments/assets/4cf67634-ae63-4906-9406-5368a94f868d" width="260" />
</p>


### 📊 Estadísticas
<p align="center">
  <img src="https://github.com/user-attachments/assets/d5846966-8854-4022-b5d8-054d3e682ec0" width="260" />
  <img src="https://github.com/user-attachments/assets/acf69044-96ab-4dd3-9694-0dbb3f00b735" width="260" />
</p>

### 👤 Perfil
<p align="center">
  <img src="https://github.com/user-attachments/assets/1193ae6e-9b3a-4aa8-be25-e46f0e3ac792" width="260" />
</p>

---

## ✨ Funcionalidades

### 🔐 Autenticación
- Registro e inicio de sesión con Firebase Authentication
- Sesión persistente y sincronizada
- Estado de usuario gestionado de forma reactiva

### 🕒 Gestión de turnos
- Crear, editar y eliminar turnos
- Cálculo automático de horas trabajadas (incluye turnos nocturnos)
- Gestión de descansos
- Cálculo de salario y propinas
- Tarifa por hora configurable
- Tarifa personalizada por turno
- Turnos agrupados por semanas

### 🏠 Dashboard
- Resumen del mes actual
- Comparativa con el mes anterior
- Últimos turnos registrados

### 📊 Estadísticas y analítica
- Gráficas con Chart.js
- Filtros por mes, semana, rango y ubicación
- Métricas avanzadas (mejor mes, promedios, €/hora)
- Proyecciones automáticas de ingresos

### 🎯 Metas y planificación
- Meta salarial mensual
- Progreso en tiempo real
- Estimación de turnos y horas necesarias
- Recomendaciones basadas en histórico
- Plan semanal sugerido

### 👤 Perfil de usuario
- Estadísticas globales
- Edición de datos personales
- Preferencias del usuario
- Cálculo de antigüedad laboral

---

## 🧠 Arquitectura

- Arquitectura basada en servicios
- Gestión de estado reactiva con BehaviorSubject
- Sincronización en tiempo real con Firestore
- Separación clara entre lógica de negocio y UI

---

## 🛠️ Tecnologías

- Ionic Framework
- Angular
- TypeScript
- Firebase (Auth & Firestore)
- RxJS
- Chart.js
- date-fns

---
## 🧩 Conceptos técnicos aplicados
- Arquitectura por servicios
- Estado reactivo con RxJS y BehaviorSubject
- CRUD avanzado con modales
- Agregación y análisis de datos
- Gestión de fechas y turnos nocturnos
- Visualización de métricas con Chart.js
- Sincronización en tiempo real con Firestore
---

## 📂 Estructura del proyecto
src/app/
├── pages/
│ ├── home
│ ├── turnos
│ ├── stats
│ ├── perfil
│ ├── login
│ └── register
├── services/
│ ├── auth.service.ts
│ ├── turno.service.ts
│ └── user.service.ts
├── components/
│ └── turno-modal
└── model/
├── user.model.ts
├── turno.model.ts
└── userSettings.model.ts


---

## 🧪 Qué demuestra este proyecto

- Autenticación real en aplicaciones móviles
- Gestión de datos en tiempo real
- Lógica de negocio compleja
- Analítica y agregación de datos
- Buenas prácticas de arquitectura frontend
- Enfoque orientado a producto

---

## 👨‍💻 Autor

**Miguel Bermejo Fierro**  
Software Developer  

📧 miguelbermejo1@gmail.com  
https://bermejomiguel.com

---

## 📌 Estado del proyecto

Proyecto de portfolio en evolución, con posibilidad de ampliar funcionalidades y métricas.


## 📌 Instalación APK:
https://drive.google.com/file/d/1vcpLCDXniHKksf_BlcQk3DFqhlQt1rC0/view?usp=drive_link

