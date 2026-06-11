import 'dotenv/config';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { createToken, requireAdmin, requireAuth } from './auth.js';
import { query } from './db.js';
const app = express();
const port = Number(process.env.API_PORT ?? 4000);
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true }));
app.use(express.json({ limit: '10mb' }));
const userSelect = `
  id, email, full_name AS "fullName", role, student_code AS "studentCode",
  phone, status, created_at AS "createdAt", updated_at AS "updatedAt"
`;
const memberSchema = z.object({
    email: z.email(),
    password: z.string().min(8),
    fullName: z.string().min(2),
    role: z.enum(['admin', 'member']).default('member'),
    studentCode: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    status: z.enum(['active', 'inactive']).default('active'),
});
const memberPatchSchema = memberSchema.partial();
function validationMessage(error) {
    return error.issues.map(issue => {
        const field = issue.path.join('.') || 'data';
        if (field === 'password' && issue.code === 'too_small')
            return 'Mật khẩu phải có ít nhất 8 ký tự';
        if (field === 'email')
            return 'Email không hợp lệ';
        if (field === 'fullName' && issue.code === 'too_small')
            return 'Họ tên phải có ít nhất 2 ký tự';
        return `${field}: ${issue.message}`;
    }).join('. ');
}
async function ensureAdmin() {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password)
        return;
    const exists = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (exists.rowCount)
        return;
    const hash = await bcrypt.hash(password, 12);
    await query(`INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, 'admin')`, [email.toLowerCase(), hash, 'Lab Administrator']);
}
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.post('/api/auth/login', async (req, res) => {
    const parsed = z.object({ email: z.email(), password: z.string() }).safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid login data' });
    const result = await query('SELECT id, email, password_hash, full_name, role, status FROM users WHERE email = $1', [parsed.data.email.toLowerCase()]);
    const user = result.rows[0];
    if (!user || user.status !== 'active' || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
        return res.status(401).json({ error: 'Email or password is incorrect' });
    }
    const profile = { id: user.id, email: user.email, role: user.role, fullName: user.full_name };
    res.json({ token: createToken(profile), user: profile });
});
app.get('/api/auth/me', requireAuth, async (req, res) => {
    const result = await query(`SELECT ${userSelect} FROM users WHERE id = $1`, [req.user.id]);
    res.json(result.rows[0]);
});
app.get('/api/members', requireAuth, requireAdmin, async (_req, res) => {
    const result = await query(`SELECT ${userSelect} FROM users ORDER BY created_at DESC`);
    res.json(result.rows);
});
app.post('/api/members', requireAuth, requireAdmin, async (req, res) => {
    const parsed = memberSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: validationMessage(parsed.error) });
    const data = parsed.data;
    const hash = await bcrypt.hash(data.password, 12);
    try {
        const result = await query(`INSERT INTO users (email, password_hash, full_name, role, student_code, phone, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${userSelect}`, [data.email.toLowerCase(), hash, data.fullName, data.role, data.studentCode, data.phone, data.status]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        res.status(error?.code === '23505' ? 409 : 500).json({ error: error?.code === '23505' ? 'Email already exists' : 'Could not create member' });
    }
});
app.patch('/api/members/:id', requireAuth, requireAdmin, async (req, res) => {
    const parsed = memberPatchSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: validationMessage(parsed.error) });
    const data = parsed.data;
    const current = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!current.rows[0])
        return res.status(404).json({ error: 'Member not found' });
    const old = current.rows[0];
    const hash = data.password ? await bcrypt.hash(data.password, 12) : old.password_hash;
    const result = await query(`UPDATE users SET email=$1, password_hash=$2, full_name=$3, role=$4, student_code=$5,
     phone=$6, status=$7, updated_at=NOW() WHERE id=$8 RETURNING ${userSelect}`, [
        (data.email ?? old.email).toLowerCase(), hash, data.fullName ?? old.full_name,
        data.role ?? old.role, data.studentCode ?? old.student_code, data.phone ?? old.phone,
        data.status ?? old.status, req.params.id,
    ]);
    res.json(result.rows[0]);
});
app.delete('/api/members/:id', requireAuth, requireAdmin, async (req, res) => {
    if (req.params.id === req.user.id)
        return res.status(400).json({ error: 'You cannot delete your own account' });
    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rowCount)
        return res.status(404).json({ error: 'Member not found' });
    res.status(204).end();
});
app.get('/api/projects', requireAuth, async (req, res) => {
    const result = await query(`SELECT DISTINCT p.* FROM projects p
     LEFT JOIN project_members pm ON pm.project_id = p.id
     WHERE p.owner_id = $1 OR pm.user_id = $1
     ORDER BY p.updated_at DESC`, [req.user.id]);
    res.json(result.rows);
});
app.post('/api/projects', requireAuth, async (req, res) => {
    const parsed = z.object({ name: z.string().min(1), description: z.string().default('') }).safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const result = await query('INSERT INTO projects (name, description, owner_id) VALUES ($1, $2, $3) RETURNING *', [parsed.data.name, parsed.data.description, req.user.id]);
    res.status(201).json(result.rows[0]);
});
app.get('/api/circuits', requireAuth, async (req, res) => {
    const result = await query(`SELECT id, name, owner_id AS "ownerId", project_id AS "projectId", version,
     created_at AS "createdAt", updated_at AS "updatedAt"
     FROM circuits WHERE owner_id = $1 ORDER BY updated_at DESC`, [req.user.id]);
    res.json(result.rows);
});
app.post('/api/circuits', requireAuth, async (req, res) => {
    const parsed = z.object({
        name: z.string().min(1),
        projectId: z.string().uuid().optional().nullable(),
        schematic: z.unknown().default({ components: [], wires: [] }),
        simConfig: z.unknown().default({}),
    }).safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const result = await query(`INSERT INTO circuits (name, owner_id, project_id, schematic, sim_config)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`, [parsed.data.name, req.user.id, parsed.data.projectId, parsed.data.schematic, parsed.data.simConfig]);
    res.status(201).json(result.rows[0]);
});
app.get('/api/circuits/:id', requireAuth, async (req, res) => {
    const result = await query(`SELECT id, name, owner_id AS "ownerId", project_id AS "projectId", schematic,
     sim_config AS "simConfig", version, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM circuits WHERE id = $1 AND owner_id = $2`, [req.params.id, req.user.id]);
    if (!result.rows[0])
        return res.status(404).json({ error: 'Circuit not found' });
    res.json(result.rows[0]);
});
app.put('/api/circuits/:id', requireAuth, async (req, res) => {
    const parsed = z.object({
        name: z.string().min(1),
        projectId: z.string().uuid().optional().nullable(),
        schematic: z.unknown(),
        simConfig: z.unknown(),
        version: z.number().int().positive(),
    }).safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const result = await query(`UPDATE circuits SET name=$1, project_id=$2, schematic=$3, sim_config=$4,
     version=version+1, updated_at=NOW()
     WHERE id=$5 AND owner_id=$6 AND version=$7 RETURNING *`, [parsed.data.name, parsed.data.projectId, parsed.data.schematic, parsed.data.simConfig, req.params.id, req.user.id, parsed.data.version]);
    if (!result.rows[0])
        return res.status(409).json({ error: 'Circuit changed on another device; reload before saving' });
    res.json(result.rows[0]);
});
app.delete('/api/circuits/:id', requireAuth, async (req, res) => {
    const result = await query('DELETE FROM circuits WHERE id=$1 AND owner_id=$2 RETURNING id', [req.params.id, req.user.id]);
    if (!result.rowCount)
        return res.status(404).json({ error: 'Circuit not found' });
    res.status(204).end();
});
app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
});
ensureAdmin()
    .then(() => app.listen(port, () => console.log(`Lab API listening on port ${port}`)))
    .catch(error => {
    console.error('Could not start API', error);
    process.exit(1);
});
