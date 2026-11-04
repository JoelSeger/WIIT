import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExportArchive } from './export-archive';

describe('ExportArchive', () => {
  let component: ExportArchive;
  let fixture: ComponentFixture<ExportArchive>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExportArchive],
    }).compileComponents();

    fixture = TestBed.createComponent(ExportArchive);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
