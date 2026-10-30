import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import { attendancePercent, percentage, Status } from '../lib/attendance'
import { subjectAverages } from '../lib/marks'
export default function ProgressReport() {
  const { id } = useParams(); const [s, setS] = useState<any>(null); const [att, setAtt] = useState<{ status: Status }[]>([]); const [marks, setMarks] = useState<any[]>([]); const [missing, setMissing] = useState(false)
  useEffect(() => { (async () => {
    const [p, a, m] = await Promise.all([supabase.from('student_profiles').select('full_name,student_code,school_name,guardian_name,enrolled_on,classes(name)').eq('id', id).maybeSingle(),
      supabase.from('attendance').select('status').eq('student_id', id), supabase.from('assessment_marks').select('score,remarks,assessments(title,max_marks,held_on,subjects(name))').eq('student_id', id)])
    if (!p.data) return setMissing(true); setS(p.data); setAtt((a.data ?? []) as any)
    setMarks((m.data ?? []).filter((x: any) => x.assessments).sort((x: any, y: any) => x.assessments.held_on.localeCompare(y.assessments.held_on))) })() }, [id])
  if (missing) return <p>Student not found.</p>; if (!s) return <p>Loading…</p>
  const avgs = subjectAverages(marks.map(x => ({ score: x.score, max: x.assessments.max_marks, subject: x.assessments.subjects?.name ?? 'Unknown' })))
  const trend = marks.map(x => ({ date: x.assessments.held_on, percent: percentage(x.score, x.assessments.max_marks) }))
  return <div className="space-y-4 bg-white rounded-2xl p-6 print:p-0 print:shadow-none"><div className="flex justify-between print:hidden"><Link className="underline" to={`/teacher/students/${id}`}>← Profile</Link><button className="bg-navy text-white rounded px-3" onClick={() => window.print()}>Print / save as PDF</button></div>
    <h1 className="text-2xl font-bold">Vijaya Tuitions — Progress report</h1>
    <p>{s.full_name} ({s.student_code}) · Class: {s.classes?.name ?? '—'} · School: {s.school_name ?? '—'} · Guardian: {s.guardian_name ?? '—'}</p>
    <p>Attendance: {att.length ? `${attendancePercent(att)}% (${att.length} recorded days)` : 'no records'}</p>
    <h2 className="font-semibold">Subject-wise performance</h2>{avgs.length === 0 ? <p>No marks recorded.</p> : <ul>{avgs.map(a => <li key={a.subject}>{a.subject}: {a.percent}%</li>)}</ul>}
    {trend.length > 1 && <div className="h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><XAxis dataKey="date" /><YAxis domain={[0, 100]} /><Tooltip /><Line dataKey="percent" stroke="#14213d" isAnimationActive={false} /></LineChart></ResponsiveContainer></div>}
    <h2 className="font-semibold">Assessment history</h2><table className="w-full"><thead><tr className="text-left"><th>Date</th><th>Assessment</th><th>Subject</th><th>Marks</th><th>%</th><th>Remarks</th></tr></thead>
      <tbody>{marks.map((x, i) => <tr key={i} className="border-t"><td>{x.assessments.held_on}</td><td>{x.assessments.title}</td><td>{x.assessments.subjects?.name}</td><td>{x.score}/{x.assessments.max_marks}</td><td>{percentage(x.score, x.assessments.max_marks)}%</td><td>{x.remarks}</td></tr>)}</tbody></table></div>
}
