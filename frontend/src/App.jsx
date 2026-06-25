import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { 
  LogOut, 
  User as UserIcon, 
  Plus, 
  Trash2, 
  Calendar, 
  AlertCircle, 
  MessageSquare, 
  ArrowLeft, 
  Mail, 
  PlusCircle, 
  Users, 
  CheckSquare 
} from 'lucide-react';
import './App.css';

const API_URL = 'http://localhost:5002/api';
const SOCKET_URL = 'http://localhost:5002';

function App() {
  // Auth state
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('pm_user') || 'null'));
  const [token, setToken] = useState(() => localStorage.getItem('pm_token') || '');

  // UI state
  const [view, setView] = useState(user ? 'dashboard' : 'auth');
  const [isRegister, setIsRegister] = useState(false);
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  
  // Modals & active elements
  const [activeModal, setActiveModal] = useState(null); // 'createProject', 'addTask', 'taskDetails', 'inviteMember'
  const [selectedColId, setSelectedColId] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('All');

  // Form states
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [projectForm, setProjectForm] = useState({ name: '', description: '' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'Medium', dueDate: '' });
  const [inviteEmail, setInviteEmail] = useState('');
  const [commentText, setCommentText] = useState('');

  // Socket reference
  const socketRef = useRef(null);

  // Helper for Axios config
  const getHeaders = () => ({
    headers: { Authorization: `Bearer ${token}` }
  });

  // Show dynamic toast notifications
  const showToast = (text, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  // Socket connection effect
  useEffect(() => {
    socketRef.current = io(SOCKET_URL);

    socketRef.current.on('connect', () => {
      console.log('Socket.io connected');
    });

    socketRef.current.on('projectUpdated', (projId) => {
      // If we are currently viewing this project, refresh it
      if (currentProject && currentProject._id === projId) {
        fetchProject(projId);
      } else {
        // Also refresh dashboard projects list
        fetchProjects();
      }
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [currentProject, token]);

  // Join/leave project socket rooms
  useEffect(() => {
    if (currentProject && socketRef.current) {
      socketRef.current.emit('joinProject', currentProject._id);
      return () => {
        socketRef.current.emit('leaveProject', currentProject._id);
      };
    }
  }, [currentProject]);

  // Fetch all user projects
  const fetchProjects = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/projects`, getHeaders());
      setProjects(res.data);
    } catch (err) {
      console.error(err);
      showToast('Failed to load projects', 'danger');
    }
  };

  // Fetch single project details
  const fetchProject = async (id) => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/projects/${id}`, getHeaders());
      setCurrentProject(res.data);
      // Keep selected task updated if it's currently open
      if (selectedTask) {
        let found = false;
        for (let col of res.data.columns) {
          const t = col.tasks.find(x => x._id === selectedTask._id);
          if (t) {
            setSelectedTask(t);
            found = true;
            break;
          }
        }
        if (!found) setSelectedTask(null);
      }
    } catch (err) {
      console.error(err);
      showToast('Error loading project board', 'danger');
    }
  };

  // Refresh projects list when entering dashboard
  useEffect(() => {
    if (view === 'dashboard') {
      fetchProjects();
      setCurrentProject(null);
    }
  }, [view, token]);

  // Authentication Handlers
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isRegister ? 'register' : 'login';
    try {
      const res = await axios.post(`${API_URL}/auth/${endpoint}`, authForm);
      const data = res.data;
      
      localStorage.setItem('pm_token', data.token);
      localStorage.setItem('pm_user', JSON.stringify(data.user));
      
      setToken(data.token);
      setUser(data.user);
      setView('dashboard');
      showToast(isRegister ? 'Registration successful!' : 'Welcome back!');
      
      // Clear forms
      setAuthForm({ name: '', email: '', password: '' });
    } catch (err) {
      const msg = err.response?.data?.msg || 'Authentication failed';
      showToast(msg, 'danger');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('pm_token');
    localStorage.removeItem('pm_user');
    setToken('');
    setUser(null);
    setView('auth');
    showToast('Logged out successfully');
  };

  // Create project handler
  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/projects`, projectForm, getHeaders());
      setProjects([...projects, res.data]);
      setProjectForm({ name: '', description: '' });
      setActiveModal(null);
      showToast('Project created successfully');
    } catch (err) {
      showToast('Failed to create project', 'danger');
    }
  };

  // Invite member handler
  const handleInviteMember = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/projects/${currentProject._id}/members`, { email: inviteEmail }, getHeaders());
      showToast(`Member invited successfully`);
      setInviteEmail('');
      setActiveModal(null);
      fetchProject(currentProject._id);
    } catch (err) {
      const msg = err.response?.data?.msg || 'Failed to invite user';
      showToast(msg, 'danger');
    }
  };

  // Add Column
  const handleAddColumn = async () => {
    const colName = prompt('Enter column name:');
    if (!colName) return;
    try {
      const res = await axios.post(`${API_URL}/projects/${currentProject._id}/columns`, { name: colName }, getHeaders());
      setCurrentProject(res.data);
      showToast('Column added');
    } catch (err) {
      showToast('Failed to add column', 'danger');
    }
  };

  // Delete Column
  const handleDeleteColumn = async (colId) => {
    if (!window.confirm('Delete this column and all its tasks?')) return;
    try {
      const res = await axios.delete(`${API_URL}/projects/${currentProject._id}/columns/${colId}`, getHeaders());
      setCurrentProject(res.data);
      showToast('Column deleted');
    } catch (err) {
      showToast('Failed to delete column', 'danger');
    }
  };

  // Create Task
  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(
        `${API_URL}/projects/${currentProject._id}/columns/${selectedColId}/tasks`, 
        taskForm, 
        getHeaders()
      );
      setCurrentProject(res.data);
      setTaskForm({ title: '', description: '', priority: 'Medium', dueDate: '' });
      setActiveModal(null);
      showToast('Task added successfully');
    } catch (err) {
      showToast('Failed to create task', 'danger');
    }
  };

  // Update Task details (like assigning a member)
  const handleUpdateTaskAssignee = async (assigneeId) => {
    if (!selectedTask) return;
    
    // Toggle assignee
    const isAssigned = selectedTask.assignees.some(a => a._id === assigneeId);
    const updatedAssignees = isAssigned
      ? selectedTask.assignees.filter(a => a._id !== assigneeId).map(a => a._id)
      : [...selectedTask.assignees.map(a => a._id), assigneeId];

    try {
      const res = await axios.put(
        `${API_URL}/projects/${currentProject._id}/tasks/${selectedTask._id}`,
        { assignees: updatedAssignees },
        getHeaders()
      );
      setCurrentProject(res.data);
      showToast('Task assignments updated');
    } catch (err) {
      showToast('Failed to update task assignees', 'danger');
    }
  };

  // Delete Task
  const handleDeleteTask = async (colId, taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      const res = await axios.delete(
        `${API_URL}/projects/${currentProject._id}/columns/${colId}/tasks/${taskId}`, 
        getHeaders()
      );
      setCurrentProject(res.data);
      setActiveModal(null);
      setSelectedTask(null);
      showToast('Task deleted');
    } catch (err) {
      showToast('Failed to delete task', 'danger');
    }
  };

  // Add Comment to Task
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const res = await axios.post(
        `${API_URL}/projects/${currentProject._id}/tasks/${selectedTask._id}/comments`,
        { text: commentText },
        getHeaders()
      );
      setCurrentProject(res.data);
      setCommentText('');
      showToast('Comment added');
    } catch (err) {
      showToast('Failed to add comment', 'danger');
    }
  };

  // Native HTML5 Drag and Drop Handlers
  const handleDragStart = (e, taskId, sourceColId) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.setData('sourceColId', sourceColId);
  };

  const handleDrop = async (e, destColId) => {
    const taskId = e.dataTransfer.getData('taskId');
    const sourceColId = e.dataTransfer.getData('sourceColId');
    if (!taskId || !sourceColId || sourceColId === destColId) return;

    // Optimistically update UI local state for zero lag
    const updatedColumns = currentProject.columns.map(col => {
      if (col._id === sourceColId) {
        const tObj = col.tasks.find(t => t._id === taskId);
        return { ...col, tasks: col.tasks.filter(t => t._id !== taskId) };
      }
      if (col._id === destColId) {
        const sourceCol = currentProject.columns.find(c => c._id === sourceColId);
        const tObj = sourceCol.tasks.find(t => t._id === taskId);
        return { ...col, tasks: [...col.tasks, tObj] };
      }
      return col;
    });

    setCurrentProject({ ...currentProject, columns: updatedColumns });

    try {
      // Send layout change to backend
      const res = await axios.put(
        `${API_URL}/projects/${currentProject._id}/board`,
        { columns: updatedColumns },
        getHeaders()
      );
      // Synchronize with exact server database response
      setCurrentProject(res.data);
    } catch (err) {
      console.error(err);
      showToast('Failed to sync board layout', 'danger');
      // Revert to original
      fetchProject(currentProject._id);
    }
  };

  // Get initials for profile rings
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const getAvatarStyle = (name) => {
    if (!name) return {};
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hues = [0, 30, 120, 200, 260, 280, 330];
    const hue = hues[hash % hues.length];
    return {
      backgroundColor: `hsl(${hue}, 85%, 93%)`,
      color: `hsl(${hue}, 85%, 35%)`,
      fontWeight: '700'
    };
  };

  const isOverdue = (dueDate, colName) => {
    if (!dueDate || colName === 'Done') return false;
    const today = new Date();
    today.setHours(0,0,0,0);
    return new Date(dueDate) < today;
  };

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="main-header">
        <div className="logo-container" onClick={() => setView(user ? 'dashboard' : 'auth')} style={{ cursor: 'pointer' }}>
          <CheckSquare className="logo-icon" size={28} />
          <span>NexusProject</span>
        </div>
        {user && (
          <div className="user-nav">
            <div className="user-info">
              <UserIcon size={18} />
              <span>{user.name}</span>
            </div>
            <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
              <LogOut size={16} /> Logout
            </button>
          </div>
        )}
      </header>

      {/* Main Views */}
      {view === 'auth' && (
        <main className="auth-page">
          <div className="auth-card">
            <h2 className="auth-title">{isRegister ? 'Create Account' : 'Welcome Back'}</h2>
            <p className="auth-subtitle">{isRegister ? 'Get started for free' : 'Sign in to manage group projects'}</p>
            
            <form onSubmit={handleAuthSubmit}>
              {isRegister && (
                <div className="auth-form-group">
                  <label className="auth-label">Full Name</label>
                  <input 
                    type="text" 
                    placeholder="John Doe" 
                    value={authForm.name}
                    onChange={e => setAuthForm({ ...authForm, name: e.target.value })}
                    required
                  />
                </div>
              )}
              <div className="auth-form-group">
                <label className="auth-label">Email Address</label>
                <input 
                  type="email" 
                  placeholder="name@example.com" 
                  value={authForm.email}
                  onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                  required
                />
              </div>
              <div className="auth-form-group">
                <label className="auth-label">Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={authForm.password}
                  onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
                {isRegister ? 'Sign Up' : 'Sign In'}
              </button>
            </form>

            <p className="auth-redirect">
              {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); setIsRegister(!isRegister); }}>
                {isRegister ? 'Sign In' : 'Sign Up'}
              </a>
            </p>
          </div>
        </main>
      )}

      {view === 'dashboard' && (
        <main className="dashboard-container">
          <div className="dashboard-header">
            <h1 className="dashboard-title">Your Workspace</h1>
            <button className="btn btn-primary" onClick={() => setActiveModal('createProject')}>
              <Plus size={18} /> New Project
            </button>
          </div>

          {projects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)' }}>
              <CheckSquare size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
              <h2>No Projects Found</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Create your first project board to begin collaborating.</p>
              <button className="btn btn-primary" onClick={() => setActiveModal('createProject')}>
                Create Project
              </button>
            </div>
          ) : (
            <div className="projects-grid">
              {projects.map(p => (
                <div key={p._id} className="project-card" onClick={() => { fetchProject(p._id); setView('board'); }}>
                  <div>
                    <h3 className="project-card-name">{p.name}</h3>
                    <p className="project-card-desc">{p.description || 'No description provided.'}</p>
                  </div>
                  <div className="project-card-footer">
                    <div className="members-avatars">
                      {p.members.slice(0, 4).map((member, i) => (
                        <div key={member._id || i} className="member-avatar" title={member.name}>
                          {getInitials(member.name)}
                        </div>
                      ))}
                      {p.members.length > 4 && (
                        <div className="member-avatar" style={{ background: 'var(--bg-tertiary)' }}>
                          +{p.members.length - 4}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Owner: {p.owner.name === user.name ? 'Me' : p.owner.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {view === 'board' && currentProject && (
        <main className="board-container">
          <div className="board-header">
            <div className="board-title-wrapper">
              <button className="btn btn-secondary" onClick={() => setView('dashboard')} style={{ padding: '8px 12px' }}>
                <ArrowLeft size={16} /> Dashboard
              </button>
              <div>
                <h1 className="board-name">{currentProject.name}</h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{currentProject.description}</p>
              </div>
            </div>
            <div className="board-actions">
              <div className="members-avatars" style={{ marginRight: '10px' }}>
                {currentProject.members.map(m => (
                  <div key={m._id} className="member-avatar" style={getAvatarStyle(m.name)} title={`${m.name} (${m.email})`}>
                    {getInitials(m.name)}
                  </div>
                ))}
              </div>
              <button className="btn btn-secondary" onClick={() => setActiveModal('inviteMember')} title="Invite Member">
                <Users size={16} /> Invite
              </button>
              <button className="btn btn-primary" onClick={handleAddColumn}>
                <Plus size={16} /> Add Column
              </button>
            </div>
          </div>

          {/* Sub-header Filter Bar */}
          <div className="board-filter-bar">
            <span className="board-filter-label">Filter Board:</span>
            <input 
              type="text" 
              placeholder="Search tasks..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="filter-search-input"
            />
            <select 
              value={priorityFilter} 
              onChange={e => setPriorityFilter(e.target.value)}
              className="filter-priority-select"
            >
              <option value="All">All Priorities</option>
              <option value="Low">Low Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="High">High Priority</option>
            </select>
            {(searchQuery || priorityFilter !== 'All') && (
              <button 
                onClick={() => { setSearchQuery(''); setPriorityFilter('All'); }} 
                className="btn btn-secondary" 
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                Clear Filters
              </button>
            )}
          </div>

          <div className="board-columns-wrapper">
            {currentProject.columns.map(col => {
              const filteredTasks = col.tasks.filter(task => {
                const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesPriority = priorityFilter === 'All' || task.priority === priorityFilter;
                return matchesSearch && matchesPriority;
              });

              return (
                <div 
                  key={col._id} 
                  className="board-column"
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => handleDrop(e, col._id)}
                >
                  <div className="column-header">
                    <h3 className="column-name">
                      {col.name} <span className="column-count">{filteredTasks.length}</span>
                    </h3>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button 
                        onClick={() => { setSelectedColId(col._id); setActiveModal('addTask'); }}
                        className="column-action-btn"
                        title="Add Task"
                      >
                        <Plus size={18} />
                      </button>
                      <button 
                        onClick={() => handleDeleteColumn(col._id)}
                        className="column-action-btn danger-btn"
                        title="Delete Column"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="tasks-list">
                    {filteredTasks.length === 0 ? (
                      <div className="empty-col-message">
                        {col.tasks.length === 0 ? 'No tasks' : 'No matches'}
                      </div>
                    ) : (
                      filteredTasks.map(task => (
                        <div 
                          key={task._id} 
                          className="task-card"
                          draggable
                          onDragStart={e => handleDragStart(e, task._id, col._id)}
                          onClick={() => { setSelectedColId(col._id); setSelectedTask(task); setActiveModal('taskDetails'); }}
                        >
                          <h4 className="task-card-title">{task.title}</h4>
                          {task.description && <p className="task-card-desc">{task.description}</p>}
                          <div className="task-card-meta">
                            <span className={`priority-badge priority-${task.priority.toLowerCase()}`}>
                              {task.priority}
                            </span>
                            {task.dueDate && (
                              <span 
                                className="due-date-badge" 
                                style={isOverdue(task.dueDate, col.name) ? { color: 'var(--danger)', fontWeight: '750' } : {}}
                                title={isOverdue(task.dueDate, col.name) ? 'Overdue!' : ''}
                              >
                                <Calendar size={12} style={isOverdue(task.dueDate, col.name) ? { color: 'var(--danger)' } : {}} /> 
                                {new Date(task.dueDate).toLocaleDateString()}
                                {isOverdue(task.dueDate, col.name) && ' (Overdue)'}
                              </span>
                            )}
                          </div>
                          {task.assignees.length > 0 && (
                            <div className="members-avatars" style={{ marginTop: '8px' }}>
                              {task.assignees.map(a => (
                                <div key={a._id} className="member-avatar" style={{ ...getAvatarStyle(a.name), width: '22px', height: '22px', fontSize: '0.65rem' }} title={a.name}>
                                  {getInitials(a.name)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
            <button className="add-column-btn" onClick={handleAddColumn}>
              <PlusCircle size={20} /> Add New Column
            </button>
          </div>
        </main>
      )}

      {/* Toast notifications rendering */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="toast" style={{ borderLeftColor: t.type === 'danger' ? 'var(--danger)' : 'var(--primary)' }}>
            <AlertCircle size={18} style={{ color: t.type === 'danger' ? 'var(--danger)' : 'var(--primary)' }} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {/* Modals Section */}
      {activeModal === 'createProject' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Create Group Project</h3>
              <button className="modal-close" onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="auth-form-group">
                <label className="auth-label">Project Name</label>
                <input 
                  type="text" 
                  value={projectForm.name}
                  onChange={e => setProjectForm({ ...projectForm, name: e.target.value })}
                  placeholder="e.g. Website Redesign"
                  required
                />
              </div>
              <div className="auth-form-group">
                <label className="auth-label">Description</label>
                <textarea 
                  value={projectForm.description}
                  onChange={e => setProjectForm({ ...projectForm, description: e.target.value })}
                  placeholder="Summarize project scope & deliverables..."
                  rows="4"
                  style={{ resize: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Board</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeModal === 'inviteMember' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Invite Team Member</h3>
              <button className="modal-close" onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <form onSubmit={handleInviteMember}>
              <div className="auth-form-group">
                <label className="auth-label">User Email Address</label>
                <input 
                  type="email" 
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="collaborator@example.com"
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Invite</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeModal === 'addTask' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add New Task Card</h3>
              <button className="modal-close" onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <form onSubmit={handleCreateTask}>
              <div className="auth-form-group">
                <label className="auth-label">Task Title</label>
                <input 
                  type="text" 
                  value={taskForm.title}
                  onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                  placeholder="e.g. Implement REST controllers"
                  required
                />
              </div>
              <div className="auth-form-group">
                <label className="auth-label">Description</label>
                <textarea 
                  value={taskForm.description}
                  onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
                  placeholder="Detail task requirements..."
                  rows="3"
                  style={{ resize: 'none' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="auth-form-group">
                  <label className="auth-label">Priority</label>
                  <select 
                    value={taskForm.priority}
                    onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div className="auth-form-group">
                  <label className="auth-label">Due Date</label>
                  <input 
                    type="date" 
                    value={taskForm.dueDate}
                    onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeModal === 'taskDetails' && selectedTask && (
        <div className="modal-overlay" onClick={() => { setActiveModal(null); setSelectedTask(null); }}>
          <div className="modal-card task-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: '16px' }}>
              <h3 className="modal-title">{selectedTask.title}</h3>
              <button className="modal-close" onClick={() => { setActiveModal(null); setSelectedTask(null); }}>✕</button>
            </div>
            
            <div className="task-detail-body">
              {/* Left Column: Details & Comments */}
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                  {selectedTask.description || 'No description added to this card.'}
                </p>

                {/* Comments Section */}
                <div className="comment-section">
                  <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MessageSquare size={16} /> Comments
                  </h4>

                  <div className="comments-list">
                    {selectedTask.comments.length === 0 ? (
                      <p style={{ fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                        No comments yet. Write below to start conversation.
                      </p>
                    ) : (
                      [...selectedTask.comments].reverse().map(comment => (
                        <div key={comment._id} className="comment-item">
                          <div className="comment-meta">
                            <span className="comment-author">{comment.userName}</span>
                            <span className="comment-time">{new Date(comment.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <p className="comment-text">{comment.text}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      placeholder="Ask a question or post update..."
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                    />
                    <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>Send</button>
                  </form>
                </div>
              </div>

              {/* Right Column: Meta Controls */}
              <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Metadata</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Priority:</span>
                      <span className={`priority-badge priority-${selectedTask.priority.toLowerCase()}`} style={{ fontSize: '0.75rem' }}>
                        {selectedTask.priority}
                      </span>
                    </div>
                    {selectedTask.dueDate && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Due:</span>
                        <span style={{ fontWeight: '600' }}>{new Date(selectedTask.dueDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Assignees</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '120px', overflowY: 'auto' }}>
                    {currentProject.members.map(member => {
                      const isAssigned = selectedTask.assignees.some(a => a._id === member._id);
                      return (
                        <label 
                          key={member._id} 
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}
                        >
                          <input 
                            type="checkbox" 
                            checked={isAssigned}
                            onChange={() => handleUpdateTaskAssignee(member._id)}
                            style={{ width: 'auto', outline: 'none' }}
                          />
                          <span>{member.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                  <button 
                    onClick={() => handleDeleteTask(selectedColId, selectedTask._id)}
                    className="btn btn-danger" 
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
                  >
                    <Trash2 size={14} /> Delete Card
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
