"""add password_hash to users

Revision ID: eaf13d0741f9
Revises: 109ab497232d
Create Date: 2025-10-08 14:50:45.576654
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "eaf13d0741f9"
down_revision: Union[str, None] = "109ab497232d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- DO NOT touch tax_profiles.id (identity column) ---
    # Add password_hash (nullable first to avoid issues on non-empty tables)
    op.add_column("users", sa.Column("password_hash", sa.String(), nullable=True))

    # Optional: backfill with placeholder if any rows exist
    op.execute("UPDATE users SET password_hash = '!' WHERE password_hash IS NULL")

    # Enforce NOT NULL
    op.alter_column("users", "password_hash", nullable=False)

    # Keep email unique. If your model still has unique=True on email,
    # either the original unique constraint or a unique index is fine.
    # Remove these two lines if they weren’t actually changed in schema.
    # (If they stay, they simply normalize to a named unique index.)
    # NOTE: If Alembic complains the constraint/index already exists, delete both lines.
    # op.drop_constraint('users_email_key', 'users', type_='unique')
    # op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)


def downgrade() -> None:
    # Reverse only what we added.
    # If you removed/created a unique for email in upgrade, mirror it here.
    # op.drop_index(op.f('ix_users_email'), table_name='users')
    # op.create_unique_constraint('users_email_key', 'users', ['email'], postgresql_nulls_not_distinct=False)

    op.drop_column("users", "password_hash")
