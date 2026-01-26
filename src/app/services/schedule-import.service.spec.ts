import { TestBed } from '@angular/core/testing';

import { ScheduleImportService } from './schedule-import.service';

describe('ScheduleImportService', () => {
  let service: ScheduleImportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ScheduleImportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
