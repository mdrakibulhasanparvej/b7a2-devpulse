export interface IIssuePayload {
  title: string;
  description: string;
  type: 'bug' | 'feature_request';
}


export interface IUpdateIssuePayload {
  title?: string;
  description?: string;
  type?: 'bug' | 'feature_request';
}