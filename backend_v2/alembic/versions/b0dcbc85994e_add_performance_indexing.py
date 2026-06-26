"""add_performance_indexing

Revision ID: b0dcbc85994e
Revises: 80ad7202a2c3
Create Date: 2026-06-25 22:06:35.629598

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b0dcbc85994e'
down_revision: Union[str, Sequence[str], None] = '80ad7202a2c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add performance indexing."""
    op.create_index('ix_codes_used', 'codes', ['used'], unique=False)
    op.create_index('ix_course_enrollments_completed', 'course_enrollments', ['completed'], unique=False)
    op.create_index('idx_course_category_published', 'courses', ['category', 'is_published'], unique=False)
    op.create_index('idx_course_status_category', 'courses', ['approval_status', 'category'], unique=False)
    op.create_index('idx_course_status_created', 'courses', ['approval_status', 'created_at'], unique=False)
    op.create_index('idx_course_status_rating', 'courses', ['approval_status', 'avg_rating'], unique=False)
    op.create_index('ix_engagement_discussion_replies_discussion_id', 'engagement_discussion_replies', ['discussion_id'], unique=False)
    op.create_index('ix_engagement_quiz_attempts_quiz_id', 'engagement_quiz_attempts', ['quiz_id'], unique=False)
    op.create_index('ix_engagement_quiz_options_question_id', 'engagement_quiz_options', ['question_id'], unique=False)
    op.create_index('ix_engagement_quiz_questions_quiz_id', 'engagement_quiz_questions', ['quiz_id'], unique=False)
    op.create_index('idx_order_status_created', 'orders', ['shipping_status', 'created_at'], unique=False)
    op.create_index('idx_product_status_created', 'products', ['status', 'created_at'], unique=False)
    op.create_index('idx_product_status_stock', 'products', ['status', 'stock'], unique=False)
    op.create_index('ix_transactions_status', 'transactions', ['status'], unique=False)
    op.create_index('ix_users_status', 'users', ['status'], unique=False)
    op.create_index('ix_video_progress_video_id', 'video_progress', ['video_id'], unique=False)
    op.create_index('ix_withdrawal_requests_status', 'withdrawal_requests', ['status'], unique=False)


def downgrade() -> None:
    """Downgrade schema - Remove performance indexing."""
    op.drop_index('ix_withdrawal_requests_status', table_name='withdrawal_requests')
    op.drop_index('ix_video_progress_video_id', table_name='video_progress')
    op.drop_index('ix_users_status', table_name='users')
    op.drop_index('ix_transactions_status', table_name='transactions')
    op.drop_index('idx_product_status_stock', table_name='products')
    op.drop_index('idx_product_status_created', table_name='products')
    op.drop_index('idx_order_status_created', table_name='orders')
    op.drop_index('ix_engagement_quiz_questions_quiz_id', table_name='engagement_quiz_questions')
    op.drop_index('ix_engagement_quiz_options_question_id', table_name='engagement_quiz_options')
    op.drop_index('ix_engagement_quiz_attempts_quiz_id', table_name='engagement_quiz_attempts')
    op.drop_index('ix_engagement_discussion_replies_discussion_id', table_name='engagement_discussion_replies')
    op.drop_index('idx_course_status_rating', table_name='courses')
    op.drop_index('idx_course_status_created', table_name='courses')
    op.drop_index('idx_course_status_category', table_name='courses')
    op.drop_index('idx_course_category_published', table_name='courses')
    op.drop_index('ix_course_enrollments_completed', table_name='course_enrollments')
    op.drop_index('ix_codes_used', table_name='codes')
