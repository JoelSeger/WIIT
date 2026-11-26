/**
 Unit tests for the XML writer (ead/xml.ts) that the EAD exports use.
 All functions are pure, so nothing is mocked: escapeText / escapeAttr / isNcName are checked
 on strings, and el + render on small element trees.


 Test Naming Convention: _TCnnn_<function>_<description> (for verification-doc match!)

 IMPORTANT : test IDs are permanent!!
  - never renumber, reuse or swap an existing TC id, not even to "tidy up" the order.
    The id links the test to the verification doc and to every old test report.
  - a new test always gets the next free number across ALL files in src/unit_tests
    (check the highest TC id first), no matter where in the file it is placed.
  - if a test is removed, its id is retired and not given to another test.
  - renaming the description part is ok, the TCnnn part stays.
 */


import { el, escapeAttr, escapeText, isNcName, render } from '../ead/xml';
import type { XmlElement } from '../ead/xml';


// ──────────────────────────────────────
// The Tests
// ──────────────────────────────────────

describe('xml', () => {

    describe('escapeText / escapeAttr', () => {

        /*
         Verifies that &, < and > are escaped, control characters XML 1.0 does not allow are
         removed (tab, newline and carriage return are kept), and non-strings are converted.
         */
        test('_TC283_escapeText_escapesAndDropsControlChars', () => {
            expect(escapeText('A & B <c> "d"')).toBe('A &amp; B &lt;c&gt; "d"');
            expect(escapeText('a\u0000b\u0008c\u000Bd\u000Ce\u001Ff')).toBe('abcdef');
            expect(escapeText('rad1\nrad2\tx\r')).toBe('rad1\nrad2\tx\r');
            expect(escapeText(42)).toBe('42');
        });


        /*
         Verifies that escapeAttr escapes the same characters as escapeText and also ".
         */
        test('_TC284_escapeAttr_alsoEscapesQuotes', () => {
            expect(escapeAttr('Sök "arkiv" & <mer>')).toBe('Sök &quot;arkiv&quot; &amp; &lt;mer&gt;');
        });

    });



    describe('el', () => {

        /*
         Verifies that el only builds the element object, and that attrs default to {} and
         content to null.
         */
        test('_TC285_el_buildsElementWithDefaults', () => {
            expect(el('dao')).toEqual({ name: 'dao', attrs: {}, content: null });
            expect(el('unittitle', { lang: 'swe' }, 'Fakturor')).toEqual({
                name: 'unittitle', attrs: { lang: 'swe' }, content: 'Fakturor',
            });
        });

    });



    describe('render', () => {

        /*
         Verifies that an element without content is self-closing: null, undefined, an empty
         list and a list with only skipped children (null, undefined, false, '', 0).
         */
        test('_TC286_render_selfClosingWithoutContent', () => {
            expect(render(el('dao'))).toBe('<dao/>');
            expect(render(el('dao', {}, undefined))).toBe('<dao/>');
            expect(render(el('dsc', {}, []))).toBe('<dsc/>');
            expect(render(el('dsc', {}, [null, undefined, false, '', 0]))).toBe('<dsc/>');
        });


        /*
         Verifies text content: a string is escaped, and a number is written as text.
         */
        test('_TC287_render_writesTextContent', () => {
            expect(render(el('unittitle', {}, 'Fakturor & kvitton'))).toBe('<unittitle>Fakturor &amp; kvitton</unittitle>');
            expect(render(el('extent', {}, 12))).toBe('<extent>12</extent>');
        });


        /*
         Verifies attributes: null, undefined, false and '' are left out, 0 and true are written,
         and values are escaped. An element without attrs object renders without attributes.
         */
        test('_TC288_render_writesAndSkipsAttributes', () => {
            const xml = render(el('c', {
                level: 'series', otherlevel: null, id: undefined, audience: false, label: '',
                count: 0, open: true, title: 'A "B" & C',
            }));

            expect(xml).toBe('<c level="series" count="0" open="true" title="A &quot;B&quot; &amp; C"/>');

            const noAttrs = { name: 'p', attrs: undefined, content: 'x' } as unknown as XmlElement;
            expect(render(noAttrs)).toBe('<p>x</p>');
        });


        /*
         Verifies nesting: children are written on their own lines, indented two spaces per
         level, skipped children are left out, and the start depth indents the whole element.
         */
        test('_TC289_render_nestsAndIndentsChildren', () => {
            const tree = el('c', { level: 'series' }, [
                el('did', {}, [el('unittitle', {}, 'Protokoll'), null]),
                false,
                el('dao', { href: 'https://example.se' }),
            ]);

            expect(render(tree)).toBe(
                '<c level="series">\n' +
                '  <did>\n' +
                '    <unittitle>Protokoll</unittitle>\n' +
                '  </did>\n' +
                '  <dao href="https://example.se"/>\n' +
                '</c>',
            );
            expect(render(el('p', {}, 'x'), 2)).toBe('    <p>x</p>');
        });

    });



    describe('isNcName', () => {

        /*
         Verifies valid id values: starts with a letter or _, then letters, digits, . _ -.
         Not valid: starting with a digit, -, or ., spaces, colons, empty string and non-strings.
         */
        test('_TC290_isNcName_checksIdValues', () => {
            expect(isNcName('UN123')).toBe(true);
            expect(isNcName('_a.b-c_1')).toBe(true);
            expect(isNcName('wiit-node-1')).toBe(true);

            expect(isNcName('1abc')).toBe(false);
            expect(isNcName('-abc')).toBe(false);
            expect(isNcName('.abc')).toBe(false);
            expect(isNcName('a b')).toBe(false);
            expect(isNcName('se:mau')).toBe(false);
            expect(isNcName('')).toBe(false);
            expect(isNcName(123)).toBe(false);
            expect(isNcName(null)).toBe(false);
        });

    });

});
