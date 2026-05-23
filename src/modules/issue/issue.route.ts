import { Router } from "express";
import { createIssue, deleteIssue, getAllIssues, getSingleIssue, updateIssue } from "./issue.controller";
import { USER_ROLE } from "../../types";
import auth from "../../ middleware/auth";


const router = Router();

router.post(
  '/', 
  auth(USER_ROLE.contributor, USER_ROLE.maintainer), 
  createIssue
);

router.get('/', getAllIssues);
router.get('/:id', getSingleIssue);

router.patch(
  '/:id', 
  auth(USER_ROLE.maintainer, USER_ROLE.contributor), 
  updateIssue
);


router.delete(
  '/:id',
  auth(USER_ROLE.maintainer),
  deleteIssue
);
export const issueRoutes = router;