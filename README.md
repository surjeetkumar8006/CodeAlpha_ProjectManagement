# NexusProject - Collaborative Kanban Board

NexusProject is a high-fidelity, real-time collaborative project management application featuring workspaces, Kanban boards supporting HTML5 Drag & Drop, card details drawers, search/priority filter systems, and overdue task date highlighting.

## 🚀 Key Features
* **HTML5 Drag & Drop Kanban**: Drag task cards between columns (To Do, In Progress, Done) or click card drawers to update properties.
* **Real-Time WebSocket Sync**: Integrated Socket.io client-server sync immediately reflects board changes, column additions, card drag movements, and comment updates on all connected team screens.
* **Overdue Task Flags**: Due dates for incomplete tasks that are in the past are highlighted in red and marked with "(Overdue)" tags.
* **Interactive Task Details Drawers**: Edit descriptions, assign team members from the project roster, adjust priority rankings (Low/Medium/High), and converse in live comment sections.
* **Workspace Dashboard**: Create group projects, invite members via email, and track workspace lists.
* **Responsive Filtering**: Filter cards by title matching or priority tags dynamically in the board control sub-header.

## 🛠️ Tech Stack
* **Frontend**: React.js, Vite, Socket.io-client, Axios, Lucide React.
* **Backend**: Node.js, Express.js, Socket.io.
* **Database**: MongoDB Atlas Cloud, Mongoose.
* **Security**: JWT tokens, bcrypt.

## 📁 API Endpoints

### Authentication
* `POST /api/auth/register` - Create account.
* `POST /api/auth/login` - Authenticate credentials and fetch token.

### Projects & Workspaces
* `GET /api/projects` - Get projects user belongs to.
* `POST /api/projects` - Create a new project workspace.
* `GET /api/projects/:id` - Fetch project columns, members, and task objects.
* `PUT /api/projects/:id/board` - Synchronize column/card coordinates.
* `POST /api/projects/:id/invite` - Add member to project roster by email.

### Tasks & Comments
* `POST /api/projects/:id/columns` - Create column.
* `DELETE /api/projects/:id/columns/:colId` - Remove column.
* `POST /api/projects/:id/columns/:colId/tasks` - Add task card to column.
* `PUT /api/projects/:id/columns/:colId/tasks/:taskId` - Edit task description, assignees, or priority.
* `POST /api/projects/:id/columns/:colId/tasks/:taskId/comments` - Append comment.

## ⚡ Quick Start

### 1. Start Backend Server
```bash
cd backend
npm install
# Set env configuration parameters in .env
node server.js
```

### 2. Start Frontend Dev Server
```bash
cd frontend
npm install
npm run dev
```
Visit `http://localhost:5174` to organize your team!
