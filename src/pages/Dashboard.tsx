import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import { attendancePercent, monthlyPercent, Status } from '../lib/attendance'
interface D { students: number; classes: number; today: { status: Status }[]; monthly: { month: string; percent: number }[]; recent: { full_name: string; created_at: string }[]; open: number }
export default function Dashboard() {
  const [d, setD] = useState<D | null>(null); const [err, setErr] = useState('')
  useEffect(() => { (async () => {
    const today = new Date().toISOString().slice(0, 10)
    const since = new Date(); since.setDate(1); since.setMonth(since.getMonth() - 5)
    const [h, s, c, a, r] = await Promise.all([
      supabase.from('assignments').select('id', { count: 'exact', head: true }).gte('due_at', new Date().toISOString()),
      supabase.from('student_profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('classes').select('id', { count: 'exact', head: true }),
      supabase.from('attendance').select('attended_on,status').gte('attended_on', since.toISOString().slice(0, 10)),
      supabase.from('student_profiles').select('full_name,created_at').order('created_at', { ascending: false }).limit(5)])
    if (s.error || h.error || c.error || a.error || r.error) return setErr('Could not load dashboard data. Please refresh or check your connection.')
    const rows = (a.data ?? []) as { attended_on: string; status: Status }[]
    setD({ open: h.count ?? 0, students: s.count ?? 0, classes: c.count ?? 0, today: rows.filter(x => x.attended_on === today), monthly: monthlyPercent(rows), recent: r.data ?? [] }) })() }, [])
  if (err) return <div className="dashboard-error" role="alert">{err}</div>
  if (!d) return <div className="dashboard-loading"><span className="loading-dot"/> Preparing your dashboard…</div>
  const pres = d.today.filter(x => x.status !== 'absent').length, abs = d.today.filter(x => x.status === 'absent').length
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const stats = [
    {label:'Active students', value:d.students, icon:'♙', tone:'violet', note:'Currently enrolled'},
    {label:'Classes', value:d.classes, icon:'▦', tone:'blue', note:'Learning groups'},
    {label:'Present / late', value:pres, icon:'✓', tone:'green', note:'Attendance today'},
    {label:'Absent today', value:abs, icon:'◷', tone:'orange', note:'Needs follow-up'},
  ]
  return <div className="dashboard-page">
    <section className="dashboard-heading"><div><div className="date-pill">{new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</div><h1>{greeting} 👋</h1><p>Here’s what’s happening at your tuition today.</p></div><Link className="primary-action" to="/teacher/students"><span>＋</span> Add student</Link></section>
    {d.students === 0 && <div className="welcome-banner"><div className="welcome-symbol">✦</div><div><strong>Your classroom starts here</strong><p>Add your first student to begin managing attendance, classes and learning progress.</p></div><Link to="/teacher/students">Add your first student <span>→</span></Link></div>}
    <section className="stats-grid">{stats.map(s=><article className="stat-card" key={s.label}><div className={'stat-icon '+s.tone}>{s.icon}</div><div className="stat-copy"><span>{s.label}</span><strong>{s.value}</strong><small>{s.note}</small></div><span className="stat-arrow">↗</span></article>)}</section>
    <section className="dashboard-middle"><article className="panel attendance-panel"><div className="panel-heading"><div><h2>Attendance overview</h2><p>Your students’ attendance over the last 6 months</p></div><span className="panel-badge">MONTHLY</span></div>
      {d.monthly.length === 0 ? <div className="empty-chart"><div className="empty-chart-icon">▥</div><strong>No attendance data yet</strong><p>Once you mark attendance, your monthly progress will appear here.</p><Link to="/teacher/attendance">Mark attendance →</Link></div> : <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={d.monthly} margin={{top:12,right:8,left:-22,bottom:0}}><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#f0eef7"/><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill:'#9691ad',fontSize:11}}/><YAxis domain={[0,100]} axisLine={false} tickLine={false} tick={{fill:'#9691ad',fontSize:10}}/><Tooltip cursor={{fill:'#f7f4ff'}} contentStyle={{border:'1px solid #efedf7',borderRadius:12,boxShadow:'0 8px 24px #30205c12'}}/><Bar dataKey="percent" name="Attendance %" fill="#8a70f4" radius={[6,6,0,0]} maxBarSize={38}/></BarChart></ResponsiveContainer></div>}
    </article><article className="panel quick-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Jump into your daily tasks</p></div><span className="quick-spark">✦</span></div><div className="quick-links"><Link to="/teacher/planner"><span className="quick-icon lavender">🗓️</span><span><strong>Daily planner</strong><small>Record subjects, notes and tests</small></span><b>→</b></Link><Link to="/teacher/attendance"><span className="quick-icon lavender">✓</span><span><strong>Mark attendance</strong><small>Record today's presence</small></span><b>→</b></Link><Link to="/teacher/classes"><span className="quick-icon sky">▦</span><span><strong>Manage classes</strong><small>Organise subjects & groups</small></span><b>→</b></Link><Link to="/teacher/assignments"><span className="quick-icon peach">✎</span><span><strong>Homework</strong><small>{d.open} open assignments</small></span><b>→</b></Link><Link to="/teacher/import"><span className="quick-icon mint">↥</span><span><strong>Import students</strong><small>Add students from a file</small></span><b>→</b></Link></div></article></section>
    <section className="panel recent-panel"><div className="panel-heading"><div><h2>Recently added students</h2><p>Your latest additions to the classroom</p></div><Link className="text-link" to="/teacher/students">View all students →</Link></div>
      {d.recent.length === 0 ? <div className="recent-empty"><span className="recent-empty-icon">♙</span><div><strong>No students just yet</strong><p>Your student list will appear here after you add learners.</p></div><Link className="secondary-action" to="/teacher/students">＋ Add student</Link></div> : <div className="recent-list">{d.recent.map((x,i)=><div className="recent-row" key={x.created_at}><span className={'student-avatar avatar-'+(i%4)}>{x.full_name.trim().split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase()}</span><span className="recent-name"><strong>{x.full_name}</strong><small>Student</small></span><span className="recent-date">Added {new Date(x.created_at).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}</span><span className="active-label"><i/> Active</span></div>)}</div>}
    </section>
    <div className="dashboard-footnote"><span>✦</span> Small steps every day lead to big progress.</div>
    <style>{`
      .dashboard-page{display:flex;flex-direction:column;gap:22px}
      .dashboard-heading{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:1px}
      .date-pill{font-size:11px;font-weight:700;color:#8176b0;margin-bottom:10px;letter-spacing:.2px}
      .dashboard-heading h1{font-size:28px;margin:0 0 8px}
      .dashboard-heading p,.panel-heading p{margin:0;color:#9691ad;font-size:12px}
      .primary-action{display:inline-flex;align-items:center;gap:8px;text-decoration:none;background:#7958ed;color:white!important;font-size:12px;font-weight:700;padding:12px 16px;border-radius:11px;box-shadow:0 5px 12px #7958ed24}
      .primary-action:hover{background:#6847df;transform:translateY(-1px)}
      .primary-action span{font-size:17px;line-height:12px}
      .welcome-banner{display:flex;align-items:center;gap:14px;background:linear-gradient(100deg,#f0ecff,#faf8ff);border:1px solid #e8e1ff;border-radius:15px;padding:16px 18px}
      .welcome-symbol{display:grid;place-items:center;flex:none;width:40px;height:40px;border-radius:13px;background:#e0d7ff;color:#7555e8;font-size:20px}
      .welcome-banner strong{font-size:13px}.welcome-banner p{margin:4px 0 0;font-size:11px;color:#817b9d;line-height:1.5}
      .welcome-banner>a{margin-left:auto;white-space:nowrap;text-decoration:none;font-size:11px;font-weight:750;color:#7253e5}.welcome-banner>a span{padding-left:5px}
      .stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
      .stat-card{position:relative;display:flex;align-items:flex-start;gap:12px;background:white;border:1px solid #efedf7;border-radius:16px;padding:18px 16px;min-height:119px;box-shadow:0 3px 14px #30205c04}
      .stat-icon{display:grid;place-items:center;flex:none;width:39px;height:39px;border-radius:12px;font-size:19px;font-weight:700}
      .stat-icon.violet{background:#f0ebff;color:#7959eb}.stat-icon.blue{background:#e9f3ff;color:#4e8de7}.stat-icon.green{background:#e5f8f0;color:#26a879}.stat-icon.orange{background:#fff0e6;color:#e9944e}
      .stat-copy{display:flex;flex-direction:column;gap:5px;min-width:0}.stat-copy>span{font-size:11px;color:#8d88a5;font-weight:600}.stat-copy strong{font-size:27px;letter-spacing:-.7px;line-height:1.1;color:#292544}.stat-copy small{font-size:10px;color:#aaa5bc}
      .stat-arrow{position:absolute;right:14px;top:13px;color:#c5bfd9;font-size:13px}
      .dashboard-middle{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,1fr);gap:16px}
      .panel{background:white;border:1px solid #efedf7;border-radius:17px;padding:20px;box-shadow:0 3px 14px #30205c04;min-width:0}
      .panel-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      .panel-heading h2{font-size:14px;margin:0 0 6px;font-weight:800;letter-spacing:-.2px}
      .panel-heading p{font-size:11px;line-height:1.5}
      .panel-badge{font-size:9px;font-weight:800;letter-spacing:1px;color:#8c79dd;background:#f3f0ff;border-radius:7px;padding:7px 9px}
      .attendance-panel{min-height:315px}.chart-wrap{height:225px;margin-top:18px}
      .empty-chart{height:228px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:12px}
      .empty-chart-icon{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:#f3efff;color:#8b70ef;font-size:22px;margin-bottom:10px}
      .empty-chart strong{font-size:12px}.empty-chart p{font-size:11px;color:#9c97b0;max-width:245px;line-height:1.6;margin:6px 0 10px}.empty-chart a{font-size:11px;font-weight:750;text-decoration:none;color:#7958ed}
      .quick-spark{color:#927cf1;font-size:18px}
      .quick-links{display:flex;flex-direction:column;margin-top:13px}
      .quick-links>a{display:flex;align-items:center;gap:11px;padding:12px 0;text-decoration:none;border-bottom:1px solid #f3f1f8}
      .quick-links>a:last-child{border-bottom:0;padding-bottom:0}.quick-links>a:hover strong{color:#7958ed}
      .quick-icon{display:grid;place-items:center;width:36px;height:36px;border-radius:11px;font-size:17px;flex:none}
      .quick-icon.lavender{background:#f0ebff;color:#7959eb}.quick-icon.sky{background:#eaf4ff;color:#4e8de7}.quick-icon.peach{background:#fff0e6;color:#e9944e}.quick-icon.mint{background:#e5f8f0;color:#26a879}
      .quick-links>a>span:nth-child(2){display:flex;flex-direction:column;gap:4px;min-width:0}.quick-links strong{font-size:11px;color:#393552}.quick-links small{font-size:10px;color:#a09ab5}.quick-links b{margin-left:auto;color:#b7b0ce;font-size:16px;font-weight:400}
      .recent-panel{padding-bottom:8px}.text-link{font-size:11px;color:#7958ed;text-decoration:none;font-weight:700;white-space:nowrap}
      .recent-empty{display:flex;align-items:center;gap:12px;padding:22px 0 14px}.recent-empty-icon{display:grid;place-items:center;width:40px;height:40px;border-radius:13px;background:#f4f1ff;color:#8a73ec;font-size:20px}.recent-empty strong{font-size:12px}.recent-empty p{font-size:11px;color:#a09ab5;margin:5px 0 0}.secondary-action{margin-left:auto;text-decoration:none;border:1px solid #e7e1ff;border-radius:9px;padding:9px 12px;color:#7656e8;font-weight:700;font-size:11px;white-space:nowrap}
      .recent-list{margin-top:12px}.recent-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid #f2f0f8}.student-avatar{display:grid;place-items:center;width:36px;height:36px;border-radius:12px;font-size:11px;font-weight:800}.avatar-0{background:#eee9ff;color:#7555e8}.avatar-1{background:#e5f4ff;color:#4486ca}.avatar-2{background:#e4f8ef;color:#2b9b73}.avatar-3{background:#fff0e6;color:#cf874b}
      .recent-name{display:flex;flex-direction:column;gap:4px}.recent-name strong{font-size:12px}.recent-name small{font-size:10px;color:#a09ab5}.recent-date{margin-left:auto;color:#9993af;font-size:10px}.active-label{display:flex;align-items:center;gap:5px;font-size:10px;color:#3ba77e;background:#eaf9f2;padding:6px 8px;border-radius:7px}.active-label i{width:5px;height:5px;border-radius:50%;background:#42bd8c}
      .dashboard-footnote{text-align:center;color:#aaa4bb;font-size:11px;padding:0 0 2px}.dashboard-footnote span{color:#9b86f2;margin-right:5px}
      .dashboard-loading,.dashboard-error{background:white;border:1px solid #efedf7;border-radius:14px;padding:24px;color:#8c86a5;font-size:13px}.loading-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#8a70f4;margin-right:9px}
      @media(max-width:1050px){.stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dashboard-middle{grid-template-columns:1fr}.attendance-panel{min-height:290px}}
      @media(max-width:600px){.dashboard-page{gap:16px}.dashboard-heading{align-items:flex-start}.dashboard-heading h1{font-size:24px}.dashboard-heading p{max-width:220px;line-height:1.5}.primary-action{padding:10px 11px;font-size:11px;white-space:nowrap}.stats-grid{gap:10px}.stat-card{padding:14px 12px;gap:9px;min-height:105px}.stat-icon{width:32px;height:32px;border-radius:10px;font-size:16px}.stat-copy>span{font-size:10px}.stat-copy strong{font-size:24px}.stat-copy small{font-size:9px}.panel{padding:16px}.welcome-banner{align-items:flex-start;flex-wrap:wrap}.welcome-banner>a{margin-left:54px}.recent-empty{flex-wrap:wrap}.secondary-action{margin-left:52px}.recent-date{display:none}.active-label{margin-left:auto}}
    `}</style>
  </div>
}
