import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, PrimaryBtn } from '../../components/UI';
import { careerPathService } from '../../../services/careerPathService';
import { API_BASE_URL } from '../../../config/apiConfig';

const LEVEL_COLORS = {
  '5th': '#8b5cf6',
  '8th': '#f59e0b',
  '10th': '#2d9e5f',
  '12th': '#ef4444'
};

const SUGGESTED_SKILLS = {
  '5th': ['Creative Thinking', 'Basic Mathematics', 'Reading Comprehension', 'Curiosity', 'Communication'],
  '8th': ['Problem Solving', 'Scientific Inquiry', 'Time Management', 'Digital Literacy', 'Teamwork'],
  '10th': ['Critical Thinking', 'Subject Specialization', 'Decision Making', 'Analytical Skills', 'Goal Setting'],
  '12th': ['Advanced Research', 'Career Planning', 'Technical Aptitude', 'Leadership', 'Interview Preparation']
};

export default function CareerDetailsPage() {
  const { level } = useParams();
  const navigate = useNavigate();
  const [careerPath, setCareerPath] = useState(null);
  const [scholarships, setScholarships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // 1. Fetch all career paths and find standard level match
        const careerRes = await careerPathService.getAllCareerPaths();
        if (careerRes.success) {
          const match = careerRes.data.find(c => c.level.toLowerCase() === level.toLowerCase());
          if (match) {
            setCareerPath(match);
          } else {
            setError('Career path not found for this level.');
          }
        }

        // 2. Fetch scholarships and filter manually
        const scholarRes = await axios.get(`${API_BASE_URL}/scholarships`);
        const levelNum = level.replace(/\D/g, ''); // extracts '5', '8', '10', '12'
        const related = scholarRes.data.filter(s => {
          if (!s.eligibility) return false;
          const eligLower = s.eligibility.toLowerCase();
          return eligLower.includes(levelNum) || eligLower.includes(level.toLowerCase());
        });
        setScholarships(related);

      } catch (err) {
        console.error("Failed to load details:", err);
        setError('Failed to load career details.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [level]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading details...</div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: 'red' }}>{error}</div>;
  if (!careerPath) return <div style={{ padding: 40, textAlign: 'center' }}>No data found.</div>;

  const standardLevel = careerPath.level; // '5th', '8th', etc.
  const color = LEVEL_COLORS[standardLevel] || '#1d5fba';
  const skills = SUGGESTED_SKILLS[standardLevel] || ['Continuous Learning', 'Adaptability'];

  return (
    <div style={{ animation: 'fadeUp 0.4s ease both', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <PrimaryBtn onClick={() => navigate('/admin/careers')} style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', marginRight: 15 }}>
          ← Back to Careers
        </PrimaryBtn>
        <h2 style={{ margin: 0 }}>Career Path Details</h2>
      </div>

      <Card style={{ borderTop: `5px solid ${color}`, marginBottom: 24, padding: 30 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontFamily: 'var(--font-heading, Nunito, sans-serif)', color: 'var(--text)' }}>
            {careerPath.title}
          </h1>
          <span style={{ background: color, color: '#fff', padding: '6px 14px', borderRadius: 20, fontWeight: 'bold', fontSize: 14 }}>
            Level: {standardLevel}
          </span>
        </div>
        <p style={{ color: 'var(--text2)', fontSize: 16, lineHeight: 1.8, marginBottom: 24 }}>
          {careerPath.description}
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 24 }}>
          <div>
            <h3 style={{ borderBottom: '2px solid var(--border)', paddingBottom: 10, marginBottom: 15 }}>Career Directions</h3>
            <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
              {careerPath.careerDirections && careerPath.careerDirections.map((dir, idx) => (
                <li key={idx} style={{ background: 'var(--surface2)', marginBottom: 8, padding: '10px 14px', borderRadius: 8, fontSize: 14, fontWeight: 500, borderLeft: `3px solid ${color}` }}>
                  {dir}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 style={{ borderBottom: '2px solid var(--border)', paddingBottom: 10, marginBottom: 15 }}>Suggested Skills</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {skills.map((skill, idx) => (
                <span key={idx} style={{ background: `${color}15`, color: color, padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <h3 style={{ marginBottom: 16, color: 'var(--text)' }}>Related Scholarships ({scholarships.length})</h3>
      {scholarships.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>
          No matching scholarships found for this level.
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {scholarships.map(s => (
            <Card key={s._id} style={{ padding: 20 }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 16 }}>{s.scholarshipName}</h4>
              <p style={{ fontSize: 13, color: 'var(--text2)', margin: '0 0 8px 0' }}><strong>Provider:</strong> {s.provider || 'N/A'}</p>
              <p style={{ fontSize: 13, color: 'var(--text2)', margin: '0 0 12px 0' }}><strong>Eligibility:</strong> {s.eligibility || 'N/A'}</p>
              <PrimaryBtn onClick={() => window.open(s.applicationLink, '_blank')} style={{ width: '100%', fontSize: 13, padding: '8px' }}>
                View Scholarship
              </PrimaryBtn>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
