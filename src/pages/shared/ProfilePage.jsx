import PageHeader from '../../components/PageHeader';
import { Loading, ErrorState } from '../../components/Feedback';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { getGroupById } from '../../services/groupService';
import { getProjectByGroupId } from '../../services/projectService';
import { isStudent } from '../../utils/roles';

const Field = ({ label, children }) => (
  <div><dt className="text-xs font-semibold text-muted">{label}</dt><dd className="mt-0.5 text-sm font-semibold">{children}</dd></div>
);

export default function ProfilePage() {
  const { user } = useAuth();
  const student = isStudent(user);
  const { data, loading, error, reload } = useAsync(async () => (student ? { group: await getGroupById(user.groupId), project: await getProjectByGroupId(user.groupId) } : {}), [user.id]);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <>
      <PageHeader title="Profile" />
      <section className="card p-6">
        <div className="mb-5 flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-lg font-bold text-primary">{user.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>
          <div><h2 className="text-lg font-bold">{user.name}</h2><p className="text-sm text-muted">{user.email}</p></div>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">{user.name}</Field>
          <Field label={student ? 'Student ID' : 'Faculty ID'}>{student ? user.studentId : user.facultyId}</Field>
          <Field label="Email">{user.email}</Field>
          <Field label="Account type">{user.accountType}</Field>
          {!student && <Field label="Faculty role">{user.role}</Field>}
          {student && <Field label="Group">{data.group?.groupName ?? '–'}</Field>}
          {student && <Field label="Project">{data.project?.title ?? '–'}</Field>}
          {!student && <Field label="Assigned groups">{user.assignedGroupIds?.length ?? 0}</Field>}
        </dl>
      </section>
    </>
  );
}
