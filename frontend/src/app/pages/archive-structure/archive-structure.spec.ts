import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArchiveStructure } from './archive-structure';

describe('ArchiveStructure', () => {
  let component: ArchiveStructure;
  let fixture: ComponentFixture<ArchiveStructure>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArchiveStructure],
    }).compileComponents();

    fixture = TestBed.createComponent(ArchiveStructure);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
