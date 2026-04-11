"""
敏感词过滤工具
用于校验用户输入的描述、提示词等内容
"""

import re
from typing import List, Tuple, Optional


class SensitiveWordFilter:
    """敏感词过滤器"""

    # 默认敏感词列表（示例，实际应从配置文件或数据库加载）
    DEFAULT_SENSITIVE_WORDS = [
        # 政治敏感
        "反动", "暴乱", "革命", "独裁", "专政",
        # 色情暴力
        "色情", "暴力", "赌博", "毒品", "枪支",
        # 诈骗相关
        "诈骗", "洗钱", "传销", "套现", "假币",
        # 其他违规
        "黑客", "攻击", "破解", "盗号", "外挂",
    ]

    def __init__(self, custom_words: Optional[List[str]] = None):
        """
        初始化过滤器

        Args:
            custom_words: 自定义敏感词列表，会合并到默认列表中
        """
        self.sensitive_words = set(self.DEFAULT_SENSITIVE_WORDS)
        if custom_words:
            self.sensitive_words.update(custom_words)

        # 编译正则表达式以提高性能
        self._compile_patterns()

    def _compile_patterns(self):
        """编译敏感词匹配模式"""
        self.patterns = []
        for word in self.sensitive_words:
            # 使用单词边界和忽略大小写
            pattern = re.compile(
                re.escape(word),
                re.IGNORECASE | re.UNICODE
            )
            self.patterns.append((word, pattern))

    def check(self, text: Optional[str]) -> Tuple[bool, List[str]]:
        """
        检查文本是否包含敏感词

        Args:
            text: 待检查的文本

        Returns:
            (是否包含敏感词, 发现的敏感词列表)
        """
        if not text:
            return False, []

        found_words = []
        for word, pattern in self.patterns:
            if pattern.search(text):
                found_words.append(word)

        return len(found_words) > 0, found_words

    def validate(self, text: Optional[str], field_name: str = "内容") -> None:
        """
        验证文本，包含敏感词时抛出异常

        Args:
            text: 待验证的文本
            field_name: 字段名称，用于错误提示

        Raises:
            ValueError: 包含敏感词时抛出
        """
        has_sensitive, words = self.check(text)
        if has_sensitive:
            raise ValueError(
                f"{field_name}包含敏感词: {', '.join(words)}"
            )

    def filter(self, text: Optional[str], replace_char: str = "*") -> Optional[str]:
        """
        过滤敏感词，替换为指定字符

        Args:
            text: 待过滤的文本
            replace_char: 替换字符

        Returns:
            过滤后的文本
        """
        if not text:
            return text

        result = text
        for word, pattern in self.patterns:
            result = pattern.sub(replace_char * len(word), result)

        return result

    def add_words(self, words: List[str]):
        """动态添加敏感词"""
        self.sensitive_words.update(words)
        self._compile_patterns()

    def remove_words(self, words: List[str]):
        """动态移除敏感词"""
        for word in words:
            self.sensitive_words.discard(word)
        self._compile_patterns()


# 全局敏感词过滤器实例
_sensitive_word_filter: Optional[SensitiveWordFilter] = None


def get_sensitive_word_filter() -> SensitiveWordFilter:
    """获取全局敏感词过滤器实例"""
    global _sensitive_word_filter
    if _sensitive_word_filter is None:
        _sensitive_word_filter = SensitiveWordFilter()
    return _sensitive_word_filter


def validate_sensitive_words(text: Optional[str], field_name: str = "内容") -> None:
    """
    便捷函数：验证文本是否包含敏感词

    Args:
        text: 待验证的文本
        field_name: 字段名称

    Raises:
        ValueError: 包含敏感词时抛出
    """
    filter_instance = get_sensitive_word_filter()
    filter_instance.validate(text, field_name)


def check_sensitive_words(text: Optional[str]) -> Tuple[bool, List[str]]:
    """
    便捷函数：检查文本是否包含敏感词

    Returns:
        (是否包含敏感词, 发现的敏感词列表)
    """
    filter_instance = get_sensitive_word_filter()
    return filter_instance.check(text)
