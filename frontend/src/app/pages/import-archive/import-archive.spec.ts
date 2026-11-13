import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImportArchiveComponent } from './import-archive';

describe('ImportArchiveComponent', () => {
  let component: ImportArchiveComponent;
  let fixture: ComponentFixture<ImportArchiveComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportArchiveComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ImportArchiveComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
