import tempfile
import unittest
from pathlib import Path
import sys

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.db.sqlite_store import SessionDB


class SessionDBTests(unittest.TestCase):
    """回归测试会话归属和基础会话行为（SQLite 持久化）。"""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.db_path = Path(self.temp_dir.name) / "test_agent.db"
        self.store = SessionDB(self.db_path)

    def tearDown(self):
        self.store = None
        self.temp_dir.cleanup()

    def test_existing_session_must_belong_to_same_user(self):
        """不同用户不能通过伪造 session_id 复用他人的会话。"""
        session = self.store.create_or_get_session(
            user_id="user-1",
            session_id="session-fixed",
            mode="travel_assistant",
            first_message="你好",
        )

        self.assertEqual("user-1", session["user_id"])

        with self.assertRaises(PermissionError):
            self.store.create_or_get_session(
                user_id="user-2",
                session_id="session-fixed",
                mode="travel_assistant",
                first_message="我想接管这个会话",
            )

    def test_append_messages_updates_preview_and_count(self):
        """追加问答后，应更新预览内容和消息数量。"""
        session = self.store.create_or_get_session(
            user_id="user-1",
            session_id=None,
            mode="travel_assistant",
            first_message="规划路线",
        )

        sid = session["session_id"]
        detail = self.store.append_messages(sid, "规划路线", "这里是一条建议路线")

        self.assertEqual(2, detail["message_count"])
        self.assertEqual("这里是一条建议路线", detail["preview"])
        self.assertEqual("user", detail["messages"][0]["role"])
        self.assertEqual("assistant", detail["messages"][1]["role"])


if __name__ == "__main__":
    unittest.main()
