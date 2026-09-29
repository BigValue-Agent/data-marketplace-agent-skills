#!/usr/bin/env python3
"""보고서 생성 전에 원 금액을 억·만원·원으로 바꾼다. 조회·집계·HTML 렌더링은 하지 않는다.

외부 패키지 없이 import 또는 CLI로 사용한다. 기본값은 원 금액을 보존하고, 평균처럼
소수 원이 생긴 값은 round_to(원)를 명시해야 한다. 반올림으로 값이 바뀌면 '약'을 붙인다.
정수 또는 Decimal/숫자 문자열을 우선하며, 이미 float에서 잃은 정밀도는 복구하지 않는다.
독립 배포를 위해 비교·찾기 스킬에 동일한 파일을 포함한다.

    python3 scripts/format_money.py 665000000
    python3 scripts/format_money.py 75370370.37 --round-to 10000
    python3 -m doctest scripts/format_money.py
"""

import argparse
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP, localcontext


def format_money(value, *, round_to=None):
    """원 단위 숫자만 받는다. 반올림은 표시용이며 원자료나 조건 판정을 바꾸지 않는다.

    >>> format_money(665000000)
    '6억 6,500만원'
    >>> format_money(635000000)
    '6억 3,500만원'
    >>> format_money(95000000)
    '9,500만원'
    >>> format_money(123456789)
    '1억 2,345만 6,789원'
    >>> format_money(100000000)
    '1억원'
    >>> format_money(9999)
    '9,999원'
    >>> format_money(0)
    '0원'
    >>> format_money(None)
    '확인 불가'
    >>> format_money(-95000000)
    '-9,500만원'
    >>> format_money("75370370.37", round_to=10000)
    '약 7,537만원'
    >>> format_money("75370370.37", round_to=1000000)
    '약 7,500만원'
    >>> format_money(99995000, round_to=10000)
    '약 1억원'
    >>> format_money("1.5")
    Traceback (most recent call last):
        ...
    ValueError: 소수 원은 round_to를 지정해 표시 정밀도를 정하세요.
    """
    if round_to is not None and (type(round_to) is not int or round_to <= 0):
        raise ValueError("round_to는 양의 정수 원 단위여야 합니다.")
    if value is None:
        return "확인 불가"
    try:
        amount = Decimal(str(value))
    except InvalidOperation as exc:
        raise ValueError("값은 원 단위 숫자여야 합니다.") from exc
    if not amount.is_finite():
        raise ValueError("값은 유한한 원 단위 숫자여야 합니다.")

    displayed = amount
    if round_to is not None:
        # 큰 금액도 중간 나눗셈에서 자릿수를 잃지 않고, 절반은 절댓값이 커지는 쪽으로 반올림한다.
        with localcontext() as context:
            context.prec = max(28, len(amount.as_tuple().digits), amount.adjusted() + 1) + len(str(round_to)) + 2
            displayed = (amount / round_to).quantize(Decimal(1), rounding=ROUND_HALF_UP) * round_to
    elif amount != amount.to_integral_value():
        raise ValueError("소수 원은 round_to를 지정해 표시 정밀도를 정하세요.")

    won = int(displayed)
    eok, remainder = divmod(abs(won), 100_000_000)
    man, remainder = divmod(remainder, 10_000)
    parts = []
    if eok:
        parts.append(f"{eok:,}억")
    if man:
        parts.append(f"{man:,}만")
    if remainder or not parts:
        parts.append(f"{remainder:,}")
    prefix = "약 " if displayed != amount else ""
    sign = "-" if won < 0 else ""
    return prefix + sign + " ".join(parts) + "원"


def main():
    parser = argparse.ArgumentParser(description="원 금액을 억·만원·원으로 표시합니다.")
    parser.add_argument("value", help="원 단위 숫자 (음수 포함)")
    parser.add_argument("--round-to", type=int, help="표시 반올림 단위(원). 생략하면 원값 보존")
    args = parser.parse_args()
    try:
        result = format_money(args.value, round_to=args.round_to)
    except ValueError as exc:
        parser.error(str(exc))
    print(result)


if __name__ == "__main__":
    main()
