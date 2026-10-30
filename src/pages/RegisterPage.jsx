import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../api/auth'
import { CheckSquare, Upload } from 'lucide-react'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    firstname: '', lastname: '', username: '', email: '', password: '',
  })
  const [picture, setPicture] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!picture) { setError('Please upload a profile picture.'); return }
    setError('')
    setLoading(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      fd.append('profilePicture', picture)
      await register(fd)
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.message ?? 'Registration failed. Try a different username or email.')
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

        <h1 className="text-2xl font-semibold text-[#f1f1f5] mb-1">Create account</h1>
        <p className="text-sm text-[#6b7280] mb-8">Start managing your tasks today</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#6b7280] mb-1.5">First name</label>
              <input value={form.firstname} onChange={set('firstname')} required
                className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2.5 text-sm text-[#f1f1f5] outline-none focus:border-indigo-500 transition-colors" />
            </div>
            <div>
              <label className="block text-xs text-[#6b7280] mb-1.5">Last name</label>
              <input value={form.lastname} onChange={set('lastname')} required
                className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2.5 text-sm text-[#f1f1f5] outline-none focus:border-indigo-500 transition-colors" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#6b7280] mb-1.5">Username</label>
            <input value={form.username} onChange={set('username')} required
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2.5 text-sm text-[#f1f1f5] outline-none focus:border-indigo-500 transition-colors" />
          </div>

          <div>
            <label className="block text-xs text-[#6b7280] mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={set('email')} required
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2.5 text-sm text-[#f1f1f5] outline-none focus:border-indigo-500 transition-colors" />
          </div>

          <div>
            <label className="block text-xs text-[#6b7280] mb-1.5">Password</label>
            <input type="password" value={form.password} onChange={set('password')} required
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2.5 text-sm text-[#f1f1f5] outline-none focus:border-indigo-500 transition-colors" />
          </div>

          <div>
            <label className="block text-xs text-[#6b7280] mb-1.5">Profile picture</label>
            <label className="flex items-center gap-2 w-full bg-[#1a1a24] border border-[#2a2a3a] border-dashed rounded-lg px-3 py-2.5 cursor-pointer hover:border-indigo-500/50 transition-colors">
              <Upload size={16} className="text-[#6b7280]" />
              <span className="text-sm text-[#6b7280]">
                {picture ? picture.name : 'Choose a file'}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setPicture(e.target.files[0])} />
            </label>
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
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="text-sm text-[#6b7280] text-center mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
