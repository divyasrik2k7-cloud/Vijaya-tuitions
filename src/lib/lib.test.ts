import { describe, it, expect } from 'vitest'
import { monthlyPercent, attendancePercent, validateMarks, percentage } from './attendance'
describe('attendance', () => {
  it('empty is 0', () => expect(attendancePercent([])).toBe(0))
  it('late counts as attended', () => expect(attendancePercent([{status:'present'},{status:'late'},{status:'absent'},{status:'absent'}])).toBe(50))
})
describe('marks', () => {
  it('rejects negative', () => expect(validateMarks(-1, 10)).not.toBeNull())
  it('rejects over max', () => expect(validateMarks(11, 10)).not.toBeNull())
  it('accepts valid', () => expect(validateMarks(7, 10)).toBeNull())
  it('percentage', () => expect(percentage(7, 20)).toBe(35))
})
describe('monthly', () => {
  it('groups by month', () => expect(monthlyPercent([{attended_on:'2026-09-01',status:'present'},{attended_on:'2026-09-02',status:'absent'},{attended_on:'2026-10-01',status:'late'}])).toEqual([{month:'2026-09',percent:50},{month:'2026-10',percent:100}]))
})
import { subjectAverages } from './marks'
describe('subjectAverages', () => {
  it('weights by max marks', () => expect(subjectAverages([{ score: 5, max: 10, subject: 'Math' }, { score: 15, max: 20, subject: 'Math' }, { score: 9, max: 10, subject: 'Sci' }])).toEqual([{ subject: 'Math', percent: 66.7 }, { subject: 'Sci', percent: 90 }]))
})
import { validateFile, safeName } from './files'
describe('files', () => {
  it('rejects exe', () => expect(validateFile({ name: 'a.exe', size: 10 })).not.toBeNull())
  it('rejects oversize', () => expect(validateFile({ name: 'a.pdf', size: 11 * 1024 * 1024 })).not.toBeNull())
  it('accepts pdf', () => expect(validateFile({ name: 'Notes.PDF', size: 1000 })).toBeNull())
  it('sanitises names', () => expect(safeName('../my file?.pdf')).toBe('.._my_file_.pdf'))
})
import { parseCsv, validateImport } from './csv'
describe('csv', () => {
  it('parses quotes and commas', () => expect(parseCsv('a,b\n"x, y","he said ""hi"""\n')).toEqual([['a', 'b'], ['x, y', 'he said "hi"']]))
  it('flags missing columns', () => expect(validateImport([['student_code', 'email']], new Set(), new Set()).missing).toEqual(['full_name']))
  it('flags duplicates and bad email', () => { const r = validateImport(parseCsv('student_code,full_name,email\nA1,Asha K,a@x.com\nA1,Bob B,bad\nC3,Cy C,a@x.com'), new Set(['Z9']), new Set()).rows
    expect(r[0].errors).toEqual([]); expect(r[1].errors).toEqual(['Invalid email', 'Duplicate student ID']); expect(r[2].errors).toEqual(['Duplicate email']) })
})
