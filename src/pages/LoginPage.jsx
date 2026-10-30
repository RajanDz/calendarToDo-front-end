import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../api/auth'
import { getUser } from '../api/tasks'
import { useAuth } from '../context/AuthContext'
import { CheckSquare } from 'lucide-react'

export default function LoginPage() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.username, form.password)
      const res = await getUser()
      setUser(res.data)
      navigate('/')
    } catch {
      setError('Invalid username or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f13] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-indigo-500 rounded-lg flex items-center justify-center">
            <CheckSquare size={18} className="text-white" />
          </div>
          <span className="text-lg font-semibold text-[#f1f1f5]">CalendarTask</span>
        </div>

        <h1 className="text-2xl font-semibold text-[#f1f1f5] mb-1">Welcome back</h1>
        <p className="text-sm text-[#6b7280] mb-8">Sign in to manage your day</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-[#6b7280] mb-1.5">Username</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2.5 text-sm text-[#f1f1f5] outline-none focus:border-indigo-500 transition-colors"
              placeholder="your_username"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-[#6b7280] mb-1.5">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2.5 text-sm text-[#f1f1f5] outline-none focus:border-indigo-500 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-sm text-[#6b7280] text-center mt-6">
          No account?{' '}
          <Link to="/register" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
