from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from app.db.base import Base


class Form(Base):
    __tablename__ = "forms"

    id = Column(Integer, primary_key=True, index=True)
    form_code = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String(1000), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    requires_approval = Column(Boolean, default=True, nullable=False)
    approval_levels = Column(Integer, default=1, nullable=False)
    print_scale = Column(Float, default=0.94, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    fields = relationship("FormFieldDefinition", back_populates="form", cascade="all, delete-orphan", order_by="FormFieldDefinition.display_order")
    assignments = relationship("FormAssignment", back_populates="form", cascade="all, delete-orphan")
    numbering = relationship("RequestNumbering", back_populates="form", uselist=False, cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="form")

    def __repr__(self):
        return f"<Form(id={self.id}, code='{self.form_code}', name='{self.name}')>"


class FormFieldDefinition(Base):
    __tablename__ = "form_field_definitions"

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.id", ondelete="CASCADE"), nullable=False)
    field_name = Column(String(100), nullable=False)
    field_label = Column(String(255), nullable=False)
    field_type = Column(String(50), nullable=False)  # text, number, date, select, textarea, checkbox, datetime, rating
    is_required = Column(Boolean, default=False, nullable=False)
    validation_rules = Column(JSON, nullable=True)
    display_order = Column(Integer, default=0, nullable=False)
    options = Column(JSON, nullable=True)  # For select/checkbox types
    default_value = Column(String(500), nullable=True)

    # Relationships
    form = relationship("Form", back_populates="fields")

    def __repr__(self):
        return f"<FormFieldDefinition(id={self.id}, field_name='{self.field_name}')>"


class FormAssignment(Base):
    __tablename__ = "form_assignments"

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False, default="submitter")  # 'submitter' or 'reviewer'
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    form = relationship("Form", back_populates="assignments")
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<FormAssignment(form_id={self.form_id}, user_id={self.user_id}, role='{self.role}')>"


class RequestNumbering(Base):
    __tablename__ = "request_numbering"

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.id", ondelete="CASCADE"), unique=True, nullable=False)
    prefix = Column(String(50), nullable=False)
    year_reset = Column(Boolean, default=False, nullable=False)
    current_sequence = Column(Integer, default=0, nullable=False)
    current_year = Column(Integer, default=0, nullable=False)

    # Relationships
    form = relationship("Form", back_populates="numbering")

    def __repr__(self):
        return f"<RequestNumbering(form_id={self.form_id}, prefix='{self.prefix}', seq={self.current_sequence})>"
