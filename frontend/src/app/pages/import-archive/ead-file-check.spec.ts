import { checkEad3Content, checkFileBasics } from './ead-file-check';

const EAD3 = `<?xml version="1.0" encoding="UTF-8"?>
<ead xmlns="http://ead3.archivists.org/schema/">
  <control><recordid>SE-MAU-KS-1004</recordid></control>
  <archdesc level="otherlevel"><did><unittitle>Informationshanteringsplan</unittitle></did></archdesc>
</ead>`;

const RA_EAD = `<?xml version="1.0" encoding="UTF-8"?>
<ead xmlns="http://xml.ra.se/EAD">
  <eadheader><eadid>GV</eadid></eadheader>
  <archdesc level="fonds"><did><unittitle>Gemensam förvaltning</unittitle></did></archdesc>
</ead>`;

describe('ead-file-check', () => {
  it('NF5 accepts .ead3, .ead and .xml, like the backend', () => {
    expect(checkFileBasics({ name: 'KS_IHP.ead3', size: 100 })).toEqual({ ok: true });
    expect(checkFileBasics({ name: 'GV.EAD', size: 100 })).toEqual({ ok: true });
    expect(checkFileBasics({ name: 'export.xml', size: 100 })).toEqual({ ok: true });
  });

  it('NF5 stops other file types, empty files and files over 20 MB', () => {
    expect(checkFileBasics({ name: 'plan.docx', size: 100 }).ok).toBe(false);
    expect(checkFileBasics({ name: 'KS_IHP.ead3', size: 0 }).ok).toBe(false);
    expect(checkFileBasics({ name: 'KS_IHP.ead3', size: 21 * 1024 * 1024 }).ok).toBe(false);
  });

  it('NF5 accepts EAD3 from Klara', () => {
    expect(checkEad3Content(EAD3)).toEqual({ ok: true });
  });

  it('NF5 stops RA-EAD (GV.ead, LS.ead) with a clear message', () => {
    const result = checkEad3Content(RA_EAD);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain('RA-EAD');
  });

  it('NF5 stops text that is not XML', () => {
    const result = checkEad3Content('hej, det här är ingen XML');

    expect(!result.ok && result.message).toContain('inte giltig XML');
  });

  it('NF5 stops XML that is not EAD', () => {
    const result = checkEad3Content('<?xml version="1.0"?><root><a/></root>');

    expect(!result.ok && result.message).toContain('<root>');
  });

  it('NF5 stops EAD without <control>', () => {
    const noControl = EAD3.replace(/<control>.*<\/control>/, '');

    expect(checkEad3Content(noControl).ok).toBe(false);
  });
});
