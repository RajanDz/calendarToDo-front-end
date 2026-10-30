import api from './axios'

export const login = (username, password) =>
  api.get(`/auth/login/${username}/${password}`)

export const logout = () =>
  api.get('/auth/logout')

export const register = (formData) =>
  api.post('/auth/registration', formData)
