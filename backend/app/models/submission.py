from datetime import datetime, timezone
import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON, Text, Enum
from sqlalchemy.orm import relationship
from app.db.base import Base


class SubmissionStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_CORRECTION = "needs_correction"


class CommentType(str, enum.Enum):
    GENERAL = "general"
    REVIEW = "review"
    CORRECTION_REQUEST = "correction_request"


class WorkflowActionType(str, enum.Enum):
    SUBMIT = "submit"
    START_REVIEW = "start_review"
    APPROVE = "approve"
    REJECT = "reject"
    REQUEST_CHANGES = "request_changes"
    RESUBMIT = "resubmit"


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    request_number = Column(String(50), unique=True, nullable=False, index=True)
    form_id = Column(Integer, ForeignKey("forms.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(Enum(SubmissionStatus), default=SubmissionStatus.DRAFT, nullable=False, index=True)
    version_number = Column(Integer, default=1, nullable=False)
    current_assignee = Column(Integer, ForeignKey("users.id"), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    form = relationship("Form", back_populates="submissions")
    user = relationship("User", back_populates="submissions", foreign_keys=[user_id])
    assignee = relationship("User", back_populates="assigned_submissions", foreign_keys=[current_assignee])
    versions = relationship("SubmissionVersion", back_populates="submission", cascade="all, delete-orphan", order_by="SubmissionVersion.version_number")
    comments = relationship("SubmissionComment", back_populates="submission", cascade="all, delete-orphan", order_by="SubmissionComment.created_at")
    workflow_actions = relationship("WorkflowAction", back_populates="submission", cascade="all, delete-orphan", order_by="WorkflowAction.created_at")

    def __repr__(self):
        return f"<Submission(id={self.id}, request_number='{self.request_number}', status='{self.status}')>"


class SubmissionVersion(Base):
    __tablename__ = "submission_versions"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    data = Column(JSON, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    is_approved_snapshot = Column(Boolean, default=False, nullable=False)

    # Relationships
    submission = relationship("Submission", back_populates="versions")
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<SubmissionVersion(submission_id={self.submission_id}, v{self.version_number})>"


class SubmissionComment(Base):
    __tablename__ = "submission_comments"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    comment = Column(Text, nullable=False)
    comment_type = Column(Enum(CommentType), default=CommentType.GENERAL, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    submission = relationship("Submission", back_populates="comments")
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<SubmissionComment(id={self.id}, type='{self.comment_type}')>"


class WorkflowAction(Base):
    __tablename__ = "workflow_actions"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(Enum(WorkflowActionType), nullable=False)
    comment = Column(Text, nullable=True)
    from_status = Column(String(50), nullable=False)
    to_status = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    submission = relationship("Submission", back_populates="workflow_actions")
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<WorkflowAction(id={self.id}, action='{self.action}')>"
