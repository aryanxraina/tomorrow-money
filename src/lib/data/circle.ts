// Money Circle sample board. Every post is made up for the demo and labelled as a sample in the UI.
import type { Group } from '../engine/understand';

export interface CirclePost {
  id: string;
  topic: string;
  /** Which groups this is most useful for. */
  groups: Group['id'][];
  area: string;
  ago: string;
  text: string;
  replies: { ago: string; text: string }[];
}

export const SAMPLE_POSTS: CirclePost[] = [
  {
    id: 's1',
    topic: 'Council tax',
    groups: ['stretched', 'catching_up'],
    area: 'Leeds',
    ago: '2 days ago',
    text: 'I never knew you could apply for Council Tax Reduction while working. The form took about 20 minutes. Has anyone else tried?',
    replies: [{ ago: '1 day ago', text: 'Yes, I did it too. Have your payslips ready before you start. It helped me.' }],
  },
  {
    id: 's2',
    topic: 'Prepayment meters',
    groups: ['stretched'],
    area: 'Leeds',
    ago: '4 days ago',
    text: 'Does anyone know how to ask about moving off a prepayment meter? I am nervous about calling.',
    replies: [{ ago: '3 days ago', text: 'Citizens Advice helped me work out what to say before I rang. Worth asking them first.' }],
  },
  {
    id: 's3',
    topic: 'Gig work tax',
    groups: ['juggler'],
    area: 'Birmingham',
    ago: '1 week ago',
    text: 'First January doing my own tax return. I put a bit aside each week from now on, because last year it was a shock.',
    replies: [],
  },
  {
    id: 's4',
    topic: 'New to the UK',
    groups: ['newcomer'],
    area: 'Peterborough',
    ago: '3 days ago',
    text: 'Tip: the Post Office near me lets you take out cash with no fee. I was paying at the machine in the corner shop for months.',
    replies: [{ ago: '2 days ago', text: 'Same here. Check the machine screen before you confirm, as some charge.' }],
  },
  {
    id: 's5',
    topic: 'Students',
    groups: ['lump_sum'],
    area: 'Manchester',
    ago: '5 days ago',
    text: 'Second year and I only just learned full-time students usually do not pay council tax. Check your letter, you may be able to get money back.',
    replies: [],
  },
  {
    id: 's6',
    topic: 'Food shop',
    groups: ['stretched', 'builder', 'fixed_cautious'],
    area: 'Manchester',
    ago: '6 days ago',
    text: 'I started doing one big shop instead of topping up at the local shop every day. It feels like it helps, but I am still working out by how much.',
    replies: [],
  },
];
