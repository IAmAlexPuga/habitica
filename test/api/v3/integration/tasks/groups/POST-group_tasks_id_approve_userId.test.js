import {
  createAndPopulateGroup,
  translate as t,
} from '../../../../../helpers/api-integration/v3';
import { find } from 'lodash';

describe('POST /tasks/:id/approve/:userId', () => {
  let user, guild, member, task;

  function findAssignedTask (memberTask) {
    return memberTask.group.id === guild._id;
  }

  beforeEach(async () => {
    let {group, members, groupLeader} = await createAndPopulateGroup({
      groupDetails: {
        name: 'Test Guild',
        type: 'guild',
      },
      members: 1,
    });

    guild = group;
    user = groupLeader;
    member = members[0];

    task = await user.post(`/tasks/group/${guild._id}`, {
      text: 'test todo',
      type: 'todo',
      requiresApproval: true,
    });
  });

  it('errors when user is not assigned', async () => {
    await expect(user.post(`/tasks/${task._id}/approve/${member._id}`))
      .to.eventually.be.rejected.and.to.eql({
        code: 404,
        error: 'NotFound',
        message: t('taskNotFound'),
      });
  });

  it('errors when user is not the group leader', async () => {
    await user.post(`/tasks/${task._id}/assign/${member._id}`);
    await expect(member.post(`/tasks/${task._id}/approve/${member._id}`))
      .to.eventually.be.rejected.and.to.eql({
        code: 401,
        error: 'NotAuthorized',
        message: t('onlyGroupLeaderCanEditTasks'),
      });
  });


  it('approves an assigned user', async () => {
    await user.post(`/tasks/${task._id}/assign/${member._id}`);
    await user.post(`/tasks/${task._id}/approve/${member._id}`);

    let memberTasks = await member.get('/tasks/user');
    let syncedTask = find(memberTasks, findAssignedTask);

    await member.sync();

    expect(member.notifications.length).to.equal(1);
    expect(member.notifications[0].type).to.equal('GROUP');
    expect(member.notifications[0].data.message).to.equal(t('yourTaskHasBeenApproved'));

    expect(syncedTask.approved).to.be.true;
    expect(syncedTask.approvingUser).to.equal(user._id);
    expect(syncedTask.approvedDate).to.be.a('string'); // date gets converted to a string as json doesn't have a Date type
  });
});
