import React, { createContext, useContext, useState, useEffect } from 'react'
import axiosInstance from '../../config/axios'

const StudentAuthCtx = createContext(null)

export function StudentAuthProvider({ children }) {
  const [student, setStudent] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(null)

  useEffect(() => {
    const savedToken = localStorage.getItem('studentToken')
    const saved = localStorage.getItem('studentData')
    if (savedToken && saved) {
      try {
        const parsed = JSON.parse(saved)
        // `userType` comes from the stored account — never re-classify it
        // from the email domain here (a Graduate with a .edu address is
        // still Graduate).
        // A stored type that is missing or outside the enum means a stale
        // session written by an older build — discard it and re-authenticate
        // so the backend provides the authoritative identity.
        const VALID_TYPES = ['school_student', 'college_student', 'graduate']
        if (!parsed?.email || !VALID_TYPES.includes(parsed.userType)) {
          localStorage.removeItem('studentToken')
          localStorage.removeItem('studentData')
        } else {
          setStudent(parsed)
          setToken(savedToken)
          setIsAuthenticated(true)

          // Background check to sync userType and academic state with database
          axiosInstance.get('/student/profile')
            .then(res => {
              if (res.data?.success && res.data.student) {
                const fresh = res.data.student
                localStorage.setItem('studentData', JSON.stringify(fresh))
                setStudent(fresh)
              }
            })
            .catch(() => {})
        }
      } catch {
        localStorage.removeItem('studentToken')
        localStorage.removeItem('studentData')
      }
    }
    setLoading(false)
  }, [])

  const login = (tok, data) => {
    localStorage.setItem('studentToken', tok)
    localStorage.setItem('studentData', JSON.stringify(data))
    setStudent(data)
    setToken(tok)
    setIsAuthenticated(true)
  }

  const logout = () => {
    localStorage.removeItem('studentToken')
    localStorage.removeItem('studentData')
    setStudent(null)
    setToken(null)
    setIsAuthenticated(false)
  }

  const updateStudent = (patch) => {
    const next = { ...student, ...patch }
    localStorage.setItem('studentData', JSON.stringify(next))
    setStudent(next)
  }

  const refreshStudent = async (freshData) => {
    if (freshData) {
      localStorage.setItem('studentData', JSON.stringify(freshData))
      setStudent(freshData)
      return freshData
    }
    const currentToken = token || localStorage.getItem('studentToken')
    if (!currentToken) return null
    try {
      const res = await axiosInstance.get('/student/profile')
      if (res.data?.success && res.data.student) {
        const fresh = res.data.student
        localStorage.setItem('studentData', JSON.stringify(fresh))
        setStudent(fresh)
        return fresh
      }
    } catch (e) {
      console.warn('Failed to refresh student profile from backend', e.message)
    }
    return null
  }

  return (
    <StudentAuthCtx.Provider value={{ student, token, isAuthenticated, loading, login, logout, updateStudent, refreshStudent }}>
      {children}
    </StudentAuthCtx.Provider>
  )
}

export const useStudentAuth = () => useContext(StudentAuthCtx)
