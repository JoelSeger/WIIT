/**
 * NF5: checks in the browser that a file is EAD3 before it is sent to the backend.
 * The backend only reads EAD3 (FGS 5 from Klara, e.g. KS_IHP.ead3). Riksarkivet's older
 * RA-EAD (EAD 2002, e.g. GV.ead and LS.ead) gives confusing errors there, so it is stopped here
 * with a clear message.
 */

/** Same rules as the backend's upload filter and size limit (importRoute.ts). */
export const ALLOWED_EXTENSIONS: readonly string[] = ['.xml', '.ead', '.ead3'];
export const MAX_IMPORT_FILE_SIZE = 20 * 1024 * 1024;

const EAD3_NAMESPACE = 'http://ead3.archivists.org/schema/';
const RA_EAD_NAMESPACE = 'http://xml.ra.se/EAD';
const BYTES_PER_MB = 1024 * 1024;

export type EadFileCheck = { ok: true } | { ok: false; message: string };

const OK: EadFileCheck = { ok: true };

/** Checks name, size and that the file is not empty, before it is read. */
export function checkFileBasics(file: Pick<File, 'name' | 'size'>): EadFileCheck {
  const name = file.name.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return fail(`Filen måste sluta på ${ALLOWED_EXTENSIONS.join(', ')}.`);
  }
  if (file.size === 0) {
    return fail('Filen är tom.');
  }
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    return fail(
      `Filen är för stor. Största tillåtna storlek är ${MAX_IMPORT_FILE_SIZE / BYTES_PER_MB} MB.`,
    );
  }
  return OK;
}

/** Checks that the text is well-formed XML with an EAD3 root (<ead> with <control>). */
export function checkEad3Content(xml: string): EadFileCheck {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return fail('Filen är inte giltig XML. Kontrollera att hela EAD3-filen kom med.');
  }
  const root = doc.documentElement;
  if (root.localName !== 'ead') {
    return fail(`Filen är XML men inte EAD. Rotelementet heter <${root.localName}>, inte <ead>.`);
  }
  const childNames = Array.from(root.children).map((child) => child.localName);
  if (root.namespaceURI === RA_EAD_NAMESPACE || childNames.includes('eadheader')) {
    return fail(
      'Filen är i Riksarkivets äldre format RA-EAD (EAD 2002), till exempel GV.ead eller LS.ead. ' +
        'Det formatet kan inte importeras än. Bara EAD3 fungerar, till exempel KS_IHP.ead3 från Klara.',
    );
  }
  if (root.namespaceURI !== null && root.namespaceURI !== EAD3_NAMESPACE) {
    return fail(`Filen är inte EAD3. Den har namnrymden ${root.namespaceURI}.`);
  }
  if (!childNames.includes('control')) {
    return fail('Filen är inte EAD3. Den saknar <control>.');
  }
  if (!childNames.includes('archdesc')) {
    return fail('Filen saknar <archdesc>, så det finns ingen struktur att importera.');
  }
  return OK;
}

function fail(message: string): EadFileCheck {
  return { ok: false, message };
}
