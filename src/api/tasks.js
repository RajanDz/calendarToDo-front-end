import api from './axios'

export const getUser = () =>
  api.get('/api/findByUsername')

export const getAllTasks = (userId) =>
  api.get(`/api/fetchTasks/${userId}`)

export const getUserProfileImg = () =>
  api.get('/api/userProfileImg')

export const getUpcomingTask = () =>
  api.get('/api/upcomingTask')

export const getTasksByDate = (date) =>
  api.get(`/api/getTasksByDate/${date}`)

export const getTasksForNext7Days = () =>
  api.get('/api/getTaskForNext7Days')

export const createTask = (task) =>
  api.post('/api/createTask', task)

export const createRepeatedTask = (task) =>
  api.post('/api/createRepeatedTask', task)

export const deleteTask = (taskId) =>
  api.delete(`/api/deleteTask/${taskId}`)

export const editTask = (dto) =>
  api.post('/api/editTaskDetails', dto)
