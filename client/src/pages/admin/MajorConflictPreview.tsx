import { Link } from 'react-router-dom';
import { MajorConflictAlert } from '../../components/MajorConflictAlert';

export default function MajorConflictPreview() {
  return <div className="conflict-preview-page">
    <div className="card card--pad stack"><div className="eyebrow">ADMINISTRATOR PREVIEW</div><h1>Opening alert preview</h1><p className="muted">This page forces the warning open without enabling it for any users.</p><Link className="btn" to="/admin/advertisements">Back to advertisements</Link></div>
    <MajorConflictAlert preview />
  </div>;
}
