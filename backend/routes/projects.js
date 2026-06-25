const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Project = require('../models/Project');
const User = require('../models/User');

// Helper to emit update if socket io is available
const notifyProjectUpdate = (req, projectId) => {
  const io = req.app.get('io');
  if (io) {
    io.to(projectId.toString()).emit('projectUpdated', projectId);
  }
};

// @route   GET api/projects
// @desc    Get all projects user is owner or member of
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [{ owner: req.user.id }, { members: req.user.id }]
    }).populate('owner', 'name email').populate('members', 'name email');
    res.json(projects);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/projects/:id
// @desc    Get project by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.id || req.params.id)
      .populate('owner', 'name email')
      .populate('members', 'name email')
      .populate('columns.tasks.assignees', 'name email')
      .populate('columns.tasks.comments.user', 'name email');

    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    // Verify member or owner
    const isOwner = project.owner._id.toString() === req.user.id;
    const isMember = project.members.some(m => m._id.toString() === req.user.id);
    if (!isOwner && !isMember) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    res.json(project);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Project not found' });
    }
    res.status(500).send('Server error');
  }
});

// @route   POST api/projects
// @desc    Create a project
// @access  Private
router.post('/', auth, async (req, res) => {
  const { name, description } = req.body;
  try {
    const newProject = new Project({
      name,
      description,
      owner: req.user.id,
      members: [req.user.id],
      columns: [
        { name: 'To Do', tasks: [] },
        { name: 'In Progress', tasks: [] },
        { name: 'Done', tasks: [] }
      ]
    });

    const project = await newProject.save();
    res.json(project);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   PUT api/projects/:id
// @desc    Update project (details)
// @access  Private
router.put('/:id', auth, async (req, res) => {
  const { name, description } = req.body;
  try {
    let project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ msg: 'Project not found' });

    if (project.owner.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    project.name = name || project.name;
    project.description = description || project.description;

    await project.save();
    notifyProjectUpdate(req, project._id);
    res.json(project);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/projects/:id/members
// @desc    Add member to project
// @access  Private
router.post('/:id/members', auth, async (req, res) => {
  const { email } = req.body;
  try {
    let project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ msg: 'Project not found' });

    if (project.owner.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized to add members' });
    }

    const invitee = await User.findOne({ email });
    if (!invitee) return res.status(404).json({ msg: 'User not found with this email' });

    if (project.members.includes(invitee._id)) {
      return res.status(400).json({ msg: 'User is already a project member' });
    }

    project.members.push(invitee._id);
    await project.save();

    notifyProjectUpdate(req, project._id);
    res.json(project);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   PUT api/projects/:id/board
// @desc    Update whole board state (for drag & drop reordering)
// @access  Private
router.put('/:id/board', auth, async (req, res) => {
  const { columns } = req.body;
  try {
    let project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ msg: 'Project not found' });

    const isMember = project.members.some(m => m.toString() === req.user.id) || project.owner.toString() === req.user.id;
    if (!isMember) return res.status(401).json({ msg: 'Not authorized' });

    project.columns = columns;
    await project.save();

    notifyProjectUpdate(req, project._id);
    res.json(project);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/projects/:id/columns
// @desc    Add new column
// @access  Private
router.post('/:id/columns', auth, async (req, res) => {
  const { name } = req.body;
  try {
    let project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ msg: 'Project not found' });

    project.columns.push({ name, tasks: [] });
    await project.save();

    notifyProjectUpdate(req, project._id);
    res.json(project);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   DELETE api/projects/:id/columns/:colId
// @desc    Delete a column
// @access  Private
router.delete('/:id/columns/:colId', auth, async (req, res) => {
  try {
    let project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ msg: 'Project not found' });

    project.columns = project.columns.filter(col => col._id.toString() !== req.params.colId);
    await project.save();

    notifyProjectUpdate(req, project._id);
    res.json(project);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/projects/:id/columns/:colId/tasks
// @desc    Add new task to column
// @access  Private
router.post('/:id/columns/:colId/tasks', auth, async (req, res) => {
  const { title, description, priority, dueDate, assignees } = req.body;
  try {
    let project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ msg: 'Project not found' });

    const column = project.columns.id(req.params.colId);
    if (!column) return res.status(404).json({ msg: 'Column not found' });

    column.tasks.push({
      title,
      description,
      priority: priority || 'Medium',
      dueDate,
      assignees: assignees || []
    });

    await project.save();
    notifyProjectUpdate(req, project._id);
    res.json(project);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   PUT api/projects/:id/tasks/:taskId
// @desc    Update task details (any column)
// @access  Private
router.put('/:id/tasks/:taskId', auth, async (req, res) => {
  const { title, description, priority, dueDate, assignees } = req.body;
  try {
    let project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ msg: 'Project not found' });

    let taskFound = null;
    for (let col of project.columns) {
      let task = col.tasks.id(req.params.taskId);
      if (task) {
        taskFound = task;
        break;
      }
    }

    if (!taskFound) return res.status(404).json({ msg: 'Task not found' });

    taskFound.title = title || taskFound.title;
    taskFound.description = description !== undefined ? description : taskFound.description;
    taskFound.priority = priority || taskFound.priority;
    taskFound.dueDate = dueDate !== undefined ? dueDate : taskFound.dueDate;
    taskFound.assignees = assignees || taskFound.assignees;

    await project.save();
    notifyProjectUpdate(req, project._id);
    res.json(project);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   DELETE api/projects/:id/columns/:colId/tasks/:taskId
// @desc    Delete a task from column
// @access  Private
router.delete('/:id/columns/:colId/tasks/:taskId', auth, async (req, res) => {
  try {
    let project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ msg: 'Project not found' });

    const column = project.columns.id(req.params.colId);
    if (!column) return res.status(404).json({ msg: 'Column not found' });

    column.tasks = column.tasks.filter(t => t._id.toString() !== req.params.taskId);
    await project.save();

    notifyProjectUpdate(req, project._id);
    res.json(project);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/projects/:id/tasks/:taskId/comments
// @desc    Add a comment to a task
// @access  Private
router.post('/:id/tasks/:taskId/comments', auth, async (req, res) => {
  const { text } = req.body;
  try {
    let project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ msg: 'Project not found' });

    let taskFound = null;
    for (let col of project.columns) {
      let task = col.tasks.id(req.params.taskId);
      if (task) {
        taskFound = task;
        break;
      }
    }

    if (!taskFound) return res.status(404).json({ msg: 'Task not found' });

    taskFound.comments.push({
      user: req.user.id,
      userName: req.user.name,
      text
    });

    await project.save();
    notifyProjectUpdate(req, project._id);
    res.json(project);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
