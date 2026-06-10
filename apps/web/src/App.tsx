import { useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from './api';

type Role = 'admin' | 'member';
type Status = 'active' | 'inactive';
type View = 'overview' | 'members' | 'circuits';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  studentCode?: string | null;
  phone?: string | null;
  status?: Status;
  createdAt?: string;
}

interface Circuit {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
}

const emptyMember = {
  email: '',
  password: '',
  fullName: '',
  role: 'member' as Role,
  studentCode: '',
  phone: '',
  status: 'active' as Status,
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [view, setView] = useState<View>('overview');
  const [loading, setLoading] = useState(Boolean(getToken()));
  const [error, setError] = useState('');
  const [login, setLogin] = useState({ email: '', password: '' });
  const [memberForm, setMemberForm] = useState(emptyMember);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState('');

  async function loadData(profile: User) {
    const circuitRows = await api<Circuit[]>('/circuits');
    setCircuits(circuitRows);
    if (profile.role === 'admin') setMembers(await api<User[]>('/members'));
  }

  useEffect(() => {
    if (!getToken()) return;
    api<User>('/auth/me')
      .then(async profile => {
        setUser(profile);
        await loadData(profile);
      })
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function submitLogin(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(login),
      });
      setToken(result.token);
      setUser(result.user);
      await loadData(result.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setToken(null);
    setUser(null);
    setMembers([]);
    setCircuits([]);
  }

  function openCreate() {
    setEditingId(null);
    setMemberForm(emptyMember);
    setDialogOpen(true);
  }

  function openEdit(member: User) {
    setEditingId(member.id);
    setMemberForm({
      email: member.email,
      password: '',
      fullName: member.fullName,
      role: member.role,
      studentCode: member.studentCode ?? '',
      phone: member.phone ?? '',
      status: member.status ?? 'active',
    });
    setDialogOpen(true);
  }

  async function saveMember(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const body = { ...memberForm } as typeof memberForm;
      if (editingId && !body.password) delete (body as Partial<typeof body>).password;
      if (editingId) {
        await api(`/members/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await api('/members', { method: 'POST', body: JSON.stringify(body) });
      }
      setMembers(await api<User[]>('/members'));
      setDialogOpen(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function removeMember(member: User) {
    if (!confirm(`Xóa thành viên ${member.fullName}?`)) return;
    try {
      await api(`/members/${member.id}`, { method: 'DELETE' });
      setMembers(prev => prev.filter(item => item.id !== member.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const filteredMembers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return members;
    return members.filter(member =>
      [member.fullName, member.email, member.studentCode, member.phone]
        .some(value => value?.toLowerCase().includes(keyword)),
    );
  }, [members, query]);

  if (loading && !user) return <div className="centerState">Đang tải...</div>;

  if (!user) {
    return (
      <main className="loginPage">
        <section className="loginVisual">
          <div className="brandIcon">L</div>
          <h1>Lab Manager</h1>
          <p>Quản lý thành viên, dự án và dữ liệu mạch điện của phòng lab.</p>
          <div className="visualGrid">
            <span>Members</span><span>Projects</span><span>Circuits</span><span>API</span>
          </div>
        </section>
        <form className="loginForm" onSubmit={submitLogin}>
          <div>
            <span className="eyebrow">LAB WORKSPACE</span>
            <h2>Đăng nhập</h2>
            <p>Sử dụng tài khoản được quản trị viên cấp.</p>
          </div>
          <label>Email<input type="email" required value={login.email} onChange={e => setLogin({ ...login, email: e.target.value })} /></label>
          <label>Mật khẩu<input type="password" required value={login.password} onChange={e => setLogin({ ...login, password: e.target.value })} /></label>
          {error && <div className="errorBox">{error}</div>}
          <button className="primary" disabled={loading}>{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
        </form>
      </main>
    );
  }

  return (
    <div className="shell">
      <aside>
        <div className="brand"><span className="brandIcon small">L</span><strong>Lab Manager</strong></div>
        <nav>
          <button className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')}>Tổng quan</button>
          {user.role === 'admin' && <button className={view === 'members' ? 'active' : ''} onClick={() => setView('members')}>Thành viên</button>}
          <button className={view === 'circuits' ? 'active' : ''} onClick={() => setView('circuits')}>File mạch</button>
        </nav>
        <div className="account">
          <strong>{user.fullName}</strong>
          <span>{user.role}</span>
          <button onClick={logout}>Đăng xuất</button>
        </div>
      </aside>

      <main className="workspace">
        <header>
          <div><span className="eyebrow">LAB WORKSPACE</span><h1>{view === 'overview' ? 'Tổng quan' : view === 'members' ? 'Thành viên' : 'File mạch'}</h1></div>
          {view === 'members' && <button className="primary compact" onClick={openCreate}>+ Thêm thành viên</button>}
        </header>
        {error && <div className="errorBox">{error}<button onClick={() => setError('')}>x</button></div>}

        {view === 'overview' && (
          <>
            <section className="metrics">
              <article><span>Thành viên</span><strong>{user.role === 'admin' ? members.length : '-'}</strong><small>Tài khoản trong lab</small></article>
              <article><span>File mạch</span><strong>{circuits.length}</strong><small>Được lưu trên server</small></article>
              <article><span>Trạng thái API</span><strong className="healthy">Online</strong><small>Đồng bộ khả dụng</small></article>
            </section>
            <section className="sectionBlock">
              <div className="sectionTitle"><div><h2>File mạch gần đây</h2><p>Dữ liệu chuẩn bị cho CircuitTH.</p></div></div>
              <CircuitTable circuits={circuits.slice(0, 5)} />
            </section>
          </>
        )}

        {view === 'members' && (
          <section className="sectionBlock">
            <div className="sectionTitle">
              <div><h2>Danh sách thành viên</h2><p>Quản lý tài khoản và quyền truy cập.</p></div>
              <input className="search" placeholder="Tìm tên, email, mã số..." value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <div className="tableWrap">
              <table>
                <thead><tr><th>Thành viên</th><th>Mã số</th><th>Vai trò</th><th>Trạng thái</th><th></th></tr></thead>
                <tbody>
                  {filteredMembers.map(member => (
                    <tr key={member.id}>
                      <td><strong>{member.fullName}</strong><span>{member.email}</span></td>
                      <td>{member.studentCode || '-'}</td>
                      <td><span className="tag">{member.role}</span></td>
                      <td><span className={`status ${member.status}`}>{member.status}</span></td>
                      <td className="actions"><button onClick={() => openEdit(member)}>Sửa</button><button className="danger" onClick={() => removeMember(member)}>Xóa</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {view === 'circuits' && (
          <section className="sectionBlock">
            <div className="sectionTitle"><div><h2>File mạch</h2><p>CircuitTH sẽ đồng bộ dữ liệu qua REST API tại đây.</p></div></div>
            <CircuitTable circuits={circuits} />
          </section>
        )}
      </main>

      {dialogOpen && (
        <div className="overlay" onMouseDown={() => setDialogOpen(false)}>
          <form className="dialog" onSubmit={saveMember} onMouseDown={e => e.stopPropagation()}>
            <div className="dialogHead"><h2>{editingId ? 'Sửa thành viên' : 'Thêm thành viên'}</h2><button type="button" onClick={() => setDialogOpen(false)}>x</button></div>
            <div className="formGrid">
              <label>Họ tên<input required value={memberForm.fullName} onChange={e => setMemberForm({ ...memberForm, fullName: e.target.value })} /></label>
              <label>Email<input type="email" required value={memberForm.email} onChange={e => setMemberForm({ ...memberForm, email: e.target.value })} /></label>
              <label>Mật khẩu<input type="password" required={!editingId} placeholder={editingId ? 'Để trống nếu không đổi' : 'Tối thiểu 8 ký tự'} value={memberForm.password} onChange={e => setMemberForm({ ...memberForm, password: e.target.value })} /></label>
              <label>Mã sinh viên<input value={memberForm.studentCode} onChange={e => setMemberForm({ ...memberForm, studentCode: e.target.value })} /></label>
              <label>Số điện thoại<input value={memberForm.phone} onChange={e => setMemberForm({ ...memberForm, phone: e.target.value })} /></label>
              <label>Vai trò<select value={memberForm.role} onChange={e => setMemberForm({ ...memberForm, role: e.target.value as Role })}><option value="member">Member</option><option value="admin">Admin</option></select></label>
              <label>Trạng thái<select value={memberForm.status} onChange={e => setMemberForm({ ...memberForm, status: e.target.value as Status })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            </div>
            <div className="dialogActions"><button type="button" onClick={() => setDialogOpen(false)}>Hủy</button><button className="primary">Lưu thành viên</button></div>
          </form>
        </div>
      )}
    </div>
  );
}

function CircuitTable({ circuits }: { circuits: Circuit[] }) {
  if (!circuits.length) return <div className="empty">Chưa có file mạch trên server.</div>;
  return (
    <div className="tableWrap">
      <table>
        <thead><tr><th>Tên file</th><th>Phiên bản</th><th>Cập nhật</th></tr></thead>
        <tbody>{circuits.map(circuit => <tr key={circuit.id}><td><strong>{circuit.name}</strong></td><td>v{circuit.version}</td><td>{new Date(circuit.updatedAt).toLocaleString('vi-VN')}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
