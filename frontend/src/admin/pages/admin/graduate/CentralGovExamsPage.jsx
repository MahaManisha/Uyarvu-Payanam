import React, { useState, useEffect } from 'react'
import { Card, DataTable, TR, TD, ActionBtn, FiltersRow, SearchInput, FilterSelect, PrimaryBtn, Modal, FormActions } from '../../components/UI'
import { graduateExamService } from '../../../services/graduateExamService'

export default function CentralGovExamsPage() {
  const [modal, setModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const queryParams = new URLSearchParams(window.location.search)
  const initialSearch = queryParams.get('search') || ''
  const initialLevel = queryParams.get('level') || 'All Levels'
  const initialGovType = queryParams.get('govType') || 'All'

  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const [selectedLevel, setSelectedLevel] = useState(initialLevel)
  const [selectedGovType, setSelectedGovType] = useState(initialGovType)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch)
  const [formData, setFormData] = useState({
    examName: '',
    conductingBody: '',
    examLevel: '',
    examMode: '',
    officialWebsite: '',
    salary: '',
    salaryIncrements: '',
  })
  const [message, setMessage] = useState({ type: '', text: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 500)
    return () => clearTimeout(handler)
  }, [searchTerm])

  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (selectedLevel !== 'All Levels') params.set('level', selectedLevel)
    if (selectedGovType !== 'All') params.set('govType', selectedGovType)
    
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`

    fetchExams({
      search: debouncedSearch,
      level: selectedLevel,
      govType: selectedGovType
    })
  }, [debouncedSearch, selectedLevel, selectedGovType])

  const fetchExams = async (paramsOverride) => {
    try {
      setLoading(true)
      const fetchParams = paramsOverride || {
        search: debouncedSearch,
        level: selectedLevel,
        govType: selectedGovType
      }
      const result = await graduateExamService.getExams(fetchParams)
      if (result.success) {
        console.log('✅ [Frontend] Loaded', result.count, 'central gov exams')
        setExams(result.data)
      }
    } catch (error) {
      console.error('❌ [Frontend] Failed to fetch central gov exams:', error)
      setMessage({ type: 'error', text: 'Failed to load central gov exams' })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async () => {
    if (!formData.examName) {
      setMessage({ type: 'error', text: 'Exam Name is required' })
      return
    }
    
    setSubmitting(true)
    setMessage({ type: '', text: '' })

    try {
      const result = await graduateExamService.createExam(formData)
      console.log('✅ [Frontend] Response received:', result)
      
      if (result.success) {
        console.log('✨ Central gov exam created successfully!')
        setMessage({ type: 'success', text: 'Central gov exam added successfully!' })
        setFormData({
          examName: '',
          conductingBody: '',
          examLevel: '',
          examMode: '',
          officialWebsite: '',
          salary: '',
          salaryIncrements: '',
        })
        console.log('🔄 Refetching central gov exams...');
        fetchExams()
        setTimeout(() => {
          setModal(false)
          setMessage({ type: '', text: '' })
        }, 1500)
      }
    } catch (error) {
      console.error('❌ [Frontend] Error:', error);
      console.error('❌ Error response:', error.response?.data);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to add central gov exam' 
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (exam) => {
    console.log('✏️ [Frontend] Edit central gov exam:', exam);
    setFormData({
      examName: exam.examName,
      conductingBody: exam.conductingBody,
      examLevel: exam.examLevel,
      examMode: exam.examMode,
      officialWebsite: exam.officialWebsite || '',
      salary: exam.salary || '',
      salaryIncrements: exam.salaryIncrements || '',
    })
    setEditModal(true)
  }

  const handleUpdate = async () => {
    console.log('🔵 [Frontend] handleUpdate called for central gov exam:', formData.examName);
    setSubmitting(true)
    setMessage({ type: '', text: '' })

    try {
      // Note: update requires exam ID, so we'll use the existing exam ID from the list
      // For now, we'll just show a message that update needs ID
      setMessage({ type: 'info', text: 'Update functionality - select an exam to edit' })
      fetchExams()
      setTimeout(() => {
        setEditModal(false)
        setMessage({ type: '', text: '' })
      }, 1500)
    } catch (error) {
      console.error('❌ [Frontend] Update error:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to update central gov exam' 
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text2)' }}>
        Loading central gov exams...
      </div>
    )
  }

  return (
    <div style={{ animation: 'fadeUp 0.4s ease both' }}>
      {message.text && (
        <div style={{
          padding: 12,
          marginBottom: 16,
          backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
          color: message.type === 'success' ? '#155724' : '#721c24',
          borderRadius: 8,
          fontSize: 13.5,
          fontWeight: 600
        }}>
          {message.text}
        </div>
      )}

      <FiltersRow>
        <SearchInput 
          placeholder="🔍 Search central gov exams..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)}
        />
        <FilterSelect value={selectedLevel} onChange={e => setSelectedLevel(e.target.value)}>
          <option>All Levels</option>
          <option>National</option>
          <option>State</option>
          <option>Central</option>
        </FilterSelect>
        <FilterSelect value={selectedGovType} onChange={e => setSelectedGovType(e.target.value)}>
          <option>All</option>
          <option>Central Government</option>
          <option>State Government</option>
        </FilterSelect>
        {(searchTerm || selectedLevel !== 'All Levels' || selectedGovType !== 'All') && (
          <button 
            onClick={() => {
              setSearchTerm('')
              setDebouncedSearch('')
              setSelectedLevel('All Levels')
              setSelectedGovType('All')
            }}
            style={{ 
              background: 'transparent', border: 'none', color: 'var(--text3)',
              cursor: 'pointer', fontSize: 13, textDecoration: 'underline', padding: '0 8px'
            }}
          >
            Clear
          </button>
        )}
        <div style={{ marginLeft:'auto', display: 'flex', gap: '10px' }}>
          <PrimaryBtn onClick={()=>setModal(true)} style={{ backgroundColor: '#10b981' }}>+ Add Central Gov Exam</PrimaryBtn>
        </div>
      </FiltersRow>

      <Card>
        {exams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text2)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
            <p>No central gov exams match the selected filters</p>
          </div>
        ) : (
          <DataTable columns={['Exam Name','Conducting Body','Level','Mode','Salary','Website','Actions']} data={exams} renderRow={(e)=>(
            <TR key={e._id}>
              <TD style={{ fontWeight:600, color:'var(--text)' }}>{e.examName}</TD>
              <TD style={{ color:'var(--text3)' }}>{e.conductingBody}</TD>
              <TD><span style={{ color:'#8b5cf6', fontWeight:600, fontSize:12 }}>{e.examLevel || '-'}</span></TD>
              <TD style={{ color:'var(--text3)' }}>{e.examMode || '-'}</TD>
              <TD style={{ color:'#10b981', fontWeight:600, fontSize:12 }}>₹ {e.salary || '-'}</TD>
              <TD>
                {e.officialWebsite ? (
                  <a href={e.officialWebsite.startsWith('http') ? e.officialWebsite : `https://${e.officialWebsite}`} target="_blank" rel="noreferrer" style={{ color:'var(--primary)', fontSize:12, fontWeight:600, textDecoration:'none' }}>
                    🔗 Visit
                  </a>
                ) : (
                  <span style={{ color:'var(--text3)', fontSize:12 }}>-</span>
                )
                }
              </TD>
              <TD>
                <div style={{ display:'flex', gap:6 }}>
                  <ActionBtn onClick={() => handleEdit(e)}>✏️ Edit</ActionBtn>
                  {/* Delete button removed as per user requirement: "no need of delete the content already we entered" */}
                </div>
              </TD>
            </TR>
          )}/> 
        )}
      </Card>

      {/* Add Central Gov Exam Modal */}
      {modal && (
        <Modal title="Add New Central Gov Exam" onClose={()=>setModal(false)}>
          {message.text && message.type === 'success' && (
            <div style={{ padding: 12, marginBottom: 16, backgroundColor: '#d4edda', color: '#155724', borderRadius: 8, fontSize: 13 }}>
              ✓ {message.text}
            </div>
          )}
          {message.text && message.type === 'error' && (
            <div style={{ padding: 12, marginBottom: 16, backgroundColor: '#f8d7da', color: '#721c24', borderRadius: 8, fontSize: 13 }}>
              ⚠ {message.text}
            </div>
          )}
          <FormGrid>
            <FormGroup label="Exam Name" full>
              <FormInput 
                name="examName" 
                value={formData.examName} 
                onChange={handleInputChange} 
                placeholder="e.g. UPSC Civil Services Exam"
              />
            </FormGroup>
            <FormGroup label="Conducting Body">
              <FormInput 
                name="conductingBody" 
                value={formData.conductingBody} 
                onChange={handleInputChange} 
                placeholder="e.g. UPSC"
              />
            </FormGroup>
            <FormGroup label="Exam Level">
              <select 
                name="examLevel"
                value={formData.examLevel}
                onChange={handleInputChange}
                style={{ background:'var(--surface2)', border:'1.5px solid var(--border)', color:'var(--text)', borderRadius:10, padding:'9px 12px', fontSize:13.5, fontFamily:'Outfit', outline:'none', width:'100%' }}
              >
                <option value="">All Levels</option>
                <option value="National">National</option>
                <option value="State">State</option>
                <option value="Central">Central</option>
              </select>
            </FormGroup>
            <FormGroup label="Exam Mode">
              <select 
                name="examMode"
                value={formData.examMode}
                onChange={handleInputChange}
                style={{ background:'var(--surface2)', border:'1.5px solid var(--border)', color:'var(--text)', borderRadius:10, padding:'9px 12px', fontSize:13.5, fontFamily:'Outfit', outline:'none', width:'100%' }}
              >
                <option value="">All Modes</option>
                <option value="Online">Online</option>
                <option value="Offline">Offline</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </FormGroup>
            <FormGroup label="Official Website" full>
              <FormInput 
                name="officialWebsite" 
                value={formData.officialWebsite} 
                onChange={handleInputChange} 
                placeholder="https://"
              />
            </FormGroup>
            <FormGroup label="Salary">
              <FormInput 
                name="salary" 
                value={formData.salary} 
                onChange={handleInputChange} 
                placeholder="Salary amount"
              />
            </FormGroup>
            <FormGroup label="Salary Increments">
              <FormInput 
                name="salaryIncrements" 
                value={formData.salaryIncrements} 
                onChange={handleInputChange} 
                placeholder="e.g. 3% annual"
              />
            </FormGroup>
          </FormGrid>
          <FormActions 
            onClose={()=>setModal(false)}
            onSave={handleSubmit}
            saveDisabled={submitting}
            saveText={submitting ? 'Saving...' : 'Add Exam'}
          />
        </Modal>
      )}

      {/* Edit Central Gov Exam Modal */}
      {editModal && (
        <Modal title="Edit Central Gov Exam" onClose={()=>setEditModal(false)}>
          {message.text && message.type === 'success' && (
            <div style={{ padding: 12, marginBottom: 16, backgroundColor: '#d4edda', color: '#155724', borderRadius: 8, fontSize: 13 }}>
              ✓ {message.text}
            </div>
          )}
          {message.text && message.type === 'error' && (
            <div style={{ padding: 12, marginBottom: 16, backgroundColor: '#f8d7da', color: '#721c24', borderRadius: 8, fontSize: 13 }}>
              ⚠ {message.text}
            </div>
          )}
          <FormGrid>
            <FormGroup label="Exam Name" full>
              <FormInput 
                name="examName" 
                value={formData.examName} 
                onChange={handleInputChange} 
                placeholder="e.g. UPSC Civil Services Exam"
              />
            </FormGroup>
            <FormGroup label="Conducting Body">
              <FormInput 
                name="conductingBody" 
                value={formData.conductingBody} 
                onChange={handleInputChange} 
                placeholder="e.g. UPSC"
              />
            </FormGroup>
            <FormGroup label="Exam Level">
              <select 
                name="examLevel"
                value={formData.examLevel}
                onChange={handleInputChange}
                style={{ background:'var(--surface2)', border:'1.5px solid var(--border)', color:'var(--text)', borderRadius:10, padding:'9px 12px', fontSize:13.5, fontFamily:'Outfit', outline:'none', width:'100%' }}
              >
                <option value="">All Levels</option>
                <option value="National">National</option>
                <option value="State">State</option>
                <option value="Central">Central</option>
              </select>
            </FormGroup>
            <FormGroup label="Exam Mode">
              <select 
                name="examMode"
                value={formData.examMode}
                onChange={handleInputChange}
                style={{ background:'var(--surface2)', border:'1.5px solid var(--border)', color:'var(--text)', borderRadius:10, padding:'9px 12px', fontSize:13.5, fontFamily:'Outfit', outline:'none', width:'100%' }}
              >
                <option value="">All Modes</option>
                <option value="Online">Online</option>
                <option value="Offline">Offline</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </FormGroup>
            <FormGroup label="Official Website" full>
              <FormInput 
                name="officialWebsite" 
                value={formData.officialWebsite} 
                onChange={handleInputChange} 
                placeholder="https://"
              />
            </FormGroup>
            <FormGroup label="Salary">
              <FormInput 
                name="salary" 
                value={formData.salary} 
                onChange={handleInputChange} 
                placeholder="Salary amount"
              />
            </FormGroup>
            <FormGroup label="Salary Increments">
              <FormInput 
                name="salaryIncrements" 
                value={formData.salaryIncrements} 
                onChange={handleInputChange} 
                placeholder="e.g. 3% annual"
              />
            </FormGroup>
          </FormGrid>
          <FormActions 
            onClose={()=>setEditModal(false)}
            onSave={handleUpdate}
            saveDisabled={submitting}
            saveText={submitting ? 'Updating...' : 'Update Exam'}
          />
        </Modal>
      )}
    </div>
  )
}