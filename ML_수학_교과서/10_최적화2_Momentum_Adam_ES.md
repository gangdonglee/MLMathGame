# 10장. 최적화 2 — Momentum, Adam, Evolution Strategy

> GD 의 단순 update 만으로는 NN 의 골짜기 / 안장점 / 비등방 곡률을 잘 다루지 못한다. 이 장은 Momentum, Adam 의 적응적 학습률, 그리고 진화 전략 (OpenAI ES, NES) 의 수학적 정의를 정리. 본 교재의 마지막 장이자 1~9 장의 종합.

---

## 10.0 한 장 요약

- **Momentum**: 그래디언트의 *지수가중평균* 을 update 방향으로. 골짜기/안장점에서 관성이 작용.
- **Nesterov accelerated gradient (NAG)**: 미리 한 발 옮긴 위치의 그래디언트 사용. $O(1/T^2)$ 수렴 (볼록).
- **Adam**: 좌표마다 *분산 추정* 으로 학습률 적응. 1차 + 2차 모멘트 결합.
- **OpenAI ES**: $J_\sigma$ 의 그래디언트 추정 + GD update. antithetic + rank shaping 으로 분산 감소.
- **NES**: ES 를 *분포 모수* 위 자연 그래디언트로 일반화. $\mu$ 와 $\Sigma$ 를 동시에 학습.
- TinyCommand 는 *가장 단순한 OpenAI ES* 형태 — natural / Adam-like 적응 없음. 단순함의 trade-off.

---

## 10.1 Momentum

### Update

$$
v_{t+1} = \beta v_t + \nabla f(\theta_t), \quad \theta_{t+1} = \theta_t - \alpha v_{t+1}.
$$

$\beta \in [0, 1)$ 이 모멘텀 계수 (보통 0.9). $v$ 는 *그래디언트의 지수가중이동평균*.

### 직관

```
얕은 골짜기:
  ─\               /─
    \            /
     \   ── ↗ ─/      ← v 가 우측 방향으로 누적
      \_/             ← GD 만으로는 좌우로 흔들림
```

진동하는 좌우 성분은 평균에서 상쇄, *일관된 방향* 만 누적. 안장점 / 평탄 영역 통과에도 도움.

### 정리 10.1 (모멘텀의 등가 형태)

$v_{t+1} = \beta v_t + g_t$, $\theta_{t+1} = \theta_t - \alpha v_{t+1}$ 는

$$
\theta_{t+1} = \theta_t - \alpha \sum_{s=0}^t \beta^{t-s} g_s
$$

와 동치. 즉 *과거 그래디언트의 지수가중평균* 이 update 방향.

증명. 점화식 풀기. □

### Heavy-ball 등의 분석

Polyak 의 heavy-ball: $\theta_{t+1} = \theta_t - \alpha g_t + \beta (\theta_t - \theta_{t-1})$. 강볼록 $f$ 에서 GD 보다 빠른 수렴 ($\sqrt\kappa$ 가 $\kappa$ 보다 좋음).

---

## 10.2 Nesterov 가속 (NAG)

### Update

$$
\tilde \theta_t = \theta_t + \beta (\theta_t - \theta_{t-1}), \quad \theta_{t+1} = \tilde\theta_t - \alpha \nabla f(\tilde\theta_t).
$$

핵심: 그래디언트를 *미리 한 발 옮긴* 점에서 평가. "look-ahead".

### 정리 10.2 (Nesterov, 1983)

$f$ 볼록 + $L$-smooth 에 NAG ($\alpha = 1/L$, 적절한 $\beta_t$) 적용하면

$$
f(\theta_T) - f^* \le \frac{2 L \|\theta_0 - \theta^*\|^2}{(T+1)^2}.
$$

GD 의 $O(1/T)$ 보다 *제곱 빠름*. 정보적 하한과 일치 (1차 정보 알고리즘의 최적).

증명은 Lyapunov 함수 + 라그랑주 보존. ML 응용에서는 Adam, momentum 의 정당화로 이 정리를 인용.

---

## 10.3 Adam

### 동기

NN 의 layer 별 그래디언트 스케일이 다름. global 학습률 한 개로는 어떤 layer 는 빠르고 어떤 layer 는 느림. *좌표마다 학습률 적응* 이 필요.

### Update

$g_t = \nabla f(\theta_t)$ 라 두고

$$
\begin{aligned}
m_t &= \beta_1 m_{t-1} + (1 - \beta_1) g_t & &\text{(1차 모멘트)} \\
v_t &= \beta_2 v_{t-1} + (1 - \beta_2) g_t \odot g_t & &\text{(2차 모멘트)} \\
\hat m_t &= m_t / (1 - \beta_1^t), \quad \hat v_t = v_t / (1 - \beta_2^t) & &\text{(bias correction)} \\
\theta_{t+1} &= \theta_t - \alpha \, \hat m_t / (\sqrt{\hat v_t} + \epsilon).
\end{aligned}
$$

기본값: $\beta_1 = 0.9, \beta_2 = 0.999, \epsilon = 10^{-8}, \alpha = 10^{-3}$.

### 좌표별 학습률 적응

$\hat v_t$ 는 그래디언트 분산의 지수가중평균. *큰 분산을 가진 좌표는 작은 step*. $\sqrt{\hat v}$ 의 출처: Newton 법 ($H^{-1}$) 의 대각 근사로 해석 (5장 §5.5.1).

### 비판 / 변종

- **AdamW**: weight decay 와 Adam 의 분리 (decoupled). 더 좋은 generalization.
- **SGD + momentum** 이 ImageNet 에서 Adam 보다 나은 generalization 을 주는 경우 자주. Adam 은 RNN/Transformer 에 강함.
- **AMSGrad** 등 수렴 보장 보강.

### Adam 과 자연 그래디언트의 관계 (8장 §8.6)

$\sqrt{\hat v}$ 는 Fisher 정보 $\mathcal I$ 의 *대각 근사의 제곱근* 으로 해석 가능. 즉 Adam 은 *대각 자연 그래디언트* 의 SGD 버전.

---

## 10.4 OpenAI ES — 정의

### 식 (4장 §4.8 의 재정리)

목적 $J(\theta)$. 부드러운 $J_\sigma(\theta) = E_{\epsilon \sim \mathcal{N}(0, I)}[J(\theta + \sigma\epsilon)]$. 그래디언트 추정

$$
\hat g = \frac{1}{N \sigma} \sum_{i=1}^N J(\theta + \sigma \epsilon_i) \cdot \epsilon_i.
$$

Update

$$
\theta_{t+1} = \theta_t + \alpha \hat g.
$$

(최대화이므로 + .)

### Antithetic (정리 6.15)

$\epsilon_i$ 와 $-\epsilon_i$ 를 쌍으로 → 짝수 차수 항 상쇄, 분산 감소.

### Centered rank shaping

$J$ 의 절대값이 학습 단계마다 변하면 $\hat g$ 도 흔들림. 해결: $J$ 를 *순위* 로 변환.

1. $N$ 개 $J(\theta + \sigma\epsilon_i)$ 를 정렬해 순위 부여.
2. 정규화: $r_i = \text{rank}(J_i) / (N - 1) - 0.5 \in [-0.5, 0.5]$.
3. $\hat g$ 에서 $J$ 대신 $r$ 사용.

### 정리 10.3 (rank shaping 의 monotone 불변)

$\phi : \mathbb{R} \to \mathbb{R}$ 가 strict 증가함수면 $\arg\max_\theta E_\epsilon[\phi(J(\theta + \sigma\epsilon))] \cdot \epsilon$ 의 방향이 보존됨 (rank 는 monotone 함수의 하나).

따라서 rank shaping 은 *진짜 그래디언트 방향* 을 (대략적으로) 보존하면서 분산을 줄인다. 형식 정당화는 Salimans et al. 2017 참고.

---

## 10.5 NES — Natural Evolution Strategy

### 동기

OpenAI ES 는 $\sigma$ 와 *방향 분포* 가 고정 ($\mathcal{N}(0, I)$). NES 는 *탐색 분포* 자체를 학습한다.

### 모수화

탐색 분포 $p(\theta | \phi) = \mathcal{N}(\mu, \Sigma)$. 모수 $\phi = (\mu, \Sigma)$.

목적 $\mathcal{J}(\phi) = E_{\theta \sim p_\phi}[J(\theta)]$. 자연 그래디언트 (8장 §8.6)

$$
\Delta \phi = \mathcal{I}(\phi)^{-1} \nabla_\phi \mathcal{J}.
$$

### Update — $\mu$

자연 그래디언트의 직접 계산이 가능. 결과:

$$
\Delta \mu = \alpha \Sigma \nabla_\mu \log p_\phi \text{ ... 정리 후 } \Delta \mu \propto \frac{1}{N\sigma} \sum r_i \epsilon_i.
$$

OpenAI ES 의 update 와 *동일한 형태*. 즉 OpenAI ES 는 NES 의 $\mu$ update 만 사용하는 특수형.

### Update — $\Sigma$ (또는 $\sigma$ 적응)

$\Sigma$ 의 자연 그래디언트는 *데이터의 공분산 정보* 로 $\Sigma$ 를 적응. 학습 진행 방향이 좁고 길면 → $\Sigma$ 가 그 방향으로 늘어남 → 다음 노이즈가 그 방향을 더 explore.

CMA-ES 가 본격적인 공분산 적응 ES.

### TinyCommand 와의 관계

[MLTrainer.cpp](../../ML/Tool/MLTrainer.cpp) 는 $\Sigma = \sigma^2 I$ 고정 + $\sigma$ 도 hand-tune. 즉 NES 의 $\mu$-only 특수형. $\sigma$ 적응을 추가하면 학습 후반에 *자동으로 더 좁은 탐색* 으로 전환 가능 (현재는 사용자가 수동).

---

## 10.6 ES vs SGD/Adam — 표 정리

| | SGD | Adam | OpenAI ES | NES (full) |
|---|---|---|---|---|
| 그래디언트 원천 | 정확 (∇L) | 정확 + 좌표 분산 | 노이즈 표본 | 노이즈 + 분포 학습 |
| 미분가능 필요 | ✓ | ✓ | X | X |
| step 당 비용 | 1× forward+back | 1× forward+back + 모멘트 | $N$× forward | $N$× forward + 분포 update |
| 노이즈 | 데이터 샘플링 | 데이터 + 모멘트 평활 | 노이즈 표본 (큼) | 적응으로 감소 |
| 비등방 곡률 적응 | X | 좌표별 ✓ | X | 공분산으로 ✓ |
| 확장성 | 단일 GPU | 단일 GPU | 평행화 ✓ (각 worker 독립) | 평행화 ✓ |
| 안장점 탈출 | 어려움 | 보통 | 좋음 (모든 방향 노이즈) | 좋음 |
| 학습률 튜닝 | 중요 | 덜 중요 | 중요 | 자동에 가까움 |

### 언제 어느 것?

- 미분 가능, 라벨 데이터 풍부 → **Adam / SGD** (NN 표준 학습)
- 미분 불가, 시뮬 환경, 평가 비싸지만 평행화 가능 → **ES / NES**
- 본 프로젝트 = 두 번째. ES 의 자연스러운 선택.

---

## 10.7 학습률 / 노이즈 / 모집단의 관계

ES 의 세 노브:

| 노브 | 효과 | 너무 크면 | 너무 작으면 |
|---|---|---|---|
| $\alpha$ (lr) | step 크기 | 발산 / oscillation | 진척 느림 |
| $\sigma$ (noise) | 탐색 반경 | $J_\sigma$ 가 $J$ 와 너무 다름 | $J_\sigma$ 가 $J$ 의 미분 불가 회피 못 함, 분산 ↑ |
| $N$ (population) | 표본 수 | wallclock 비용 ↑ | 추정 분산 ↑ |

### 정성 관계

- $\sigma$ 작아지면 $J_\sigma \to J$ 지만 $\hat g$ 분산 $\propto 1/\sigma^2$ 로 폭발. → $N$ 증가가 필요.
- $\alpha$ 의 안전 상한 ≈ $1/L$ ($L$ ≈ $J_\sigma$ 의 매끄러움 상수, $\sigma$ 가 작을수록 $L$ 큼).
- $N$ 의 효과 = 표본평균의 표준오차 $\propto 1/\sqrt N$ (정리 6.13 + CLT).

본 프로젝트는 (population=50, sigma=0.10, lr=0.05) 의 보수적 조합. winner archive 에서 점수가 잘 안 오르면 sigma 를 0.05 로 줄이거나 N 을 100 으로 늘리는 것이 표준 진단.

---

## 10.8 ML 응용 미리보기

| 개념 | 어디서 다시 |
|---|---|
| Momentum | SGD-momentum, Adam |
| NAG | Adam-W 의 일부 변종 |
| Adam | NN 학습의 사실상 표준 |
| OpenAI ES | OpenAI 2017 논문, 강화학습 대안 |
| NES / CMA-ES | black-box 최적화 표준 |

---

## 10.9 TinyCommand 연결 — 종합

### 10.9.1 한 generation 의 수학 — 줄별

[MLTrainer.cpp](../../ML/Tool/MLTrainer.cpp) 의 `Train` 한 generation 을 수학 식과 1:1.

| 코드 단계 | 수학 |
|---|---|
| $\epsilon_i \sim \mathcal{N}(0, I_{1670})$ N/2 개 | 정의 7.3 (다변량 정규) |
| $\theta + \sigma \epsilon_i$, $\theta - \sigma \epsilon_i$ | 정리 7.2 (선형 변환) |
| 시뮬 평가 → $J^+, J^-$ | $J(\theta')$ 의 black-box 평가 |
| 점수 정렬 → 순위 → $r^+, r^-$ | rank shaping (§10.4) |
| $\hat g = \frac{1}{N\sigma} \sum (r^+_i - r^-_i) \epsilon_i$ | 정리 4.14 + antithetic (정리 6.15) |
| $\theta \leftarrow \theta + \alpha \hat g$ | GD update (정리 9.9) |

### 10.9.2 NN policy 의 1670 차원 = ES 의 작업 공간

PolicyNet 의 모든 weight (정의 5.6 의 합성 함수의 모수) 는 그냥 ℝ^1670 의 벡터로 ES 에 보임. ES 는 NN 의 *구조* 를 모름 (정리 4.14 의 black-box 가정).

### 10.9.3 Adam 으로 가지 않는 이유

Adam 의 $v_t = \beta_2 v_{t-1} + (1-\beta_2) g_t^2$ 같은 좌표별 분산 추정은 ES 에서 자연스럽게 가능 (∇ 추정의 분산을 좌표별로 모니터). 그러나 본 프로젝트는 (a) 코드 단순성 (b) 평행화 우선 (c) NES/CMA 같은 분포 적응이 더 자연 의 이유로 Adam-like 적응 미적용. 추후 실험 가치는 있다.

### 10.9.4 모든 장의 종합

| 장 | TinyCommand 에서 |
|---|---|
| 1 (벡터) | weight, ε, feature ∈ ℝⁿ |
| 2 (행렬) | NN layer 의 W |
| 3 (SVD) | $\Sigma = \sigma^2 I$ → SVD 자명 |
| 4 (그래디언트) | $\hat g$ 정의 |
| 5 (체인룰) | NN forward (백프롭 미사용) |
| 6 (확률) | antithetic 분산 감소 |
| 7 (정규분포) | He 초기화, 노이즈 분포 |
| 8 (KL) | argmax = entropy 0, NES 로의 길 |
| 9 (GD) | $\theta + \alpha \hat g$ |
| 10 (ES) | 종합 |

---

## 10.10 연습문제

1. Momentum update (§10.1) 에서 $f(x) = \tfrac{1}{2} x^\top A x$ ($A$ PD) 일 때, $\beta = 0$ vs $\beta > 0$ 의 수렴 속도 차이를 고윳값 분해로 분석하라.
2. Adam 의 bias correction $\hat m_t = m_t / (1 - \beta_1^t)$ 가 왜 필요한가? $m_0 = 0$ 으로 시작할 때 초기 $m_t$ 가 $E[g]$ 의 *편향된* 추정임을 보여라.
3. OpenAI ES 의 antithetic 분산 감소 (정리 6.15) 를 NES 의 $\mu$ update 에 그대로 적용 가능한지 논하라.
4. 정리 10.3 (rank shaping 의 monotone 불변) 를 strict 증가 $\phi$ 에 대해 유사하게 진술하고 직관 증명을 적어라.
5. (TinyCommand) `MLTrainer::Params` 에 $\Sigma$ 적응 (대각만) 을 추가한다고 가정. 의사코드를 적고, 한 generation 당 추가 비용 / 메모리를 정량화하라.
6. (종합) PolicyNet 의 학습이 정체된다는 가정 하에, 1~10 장의 도구로 점진적 진단 절차를 적어라 (예: feature 분포 → 노이즈 분산 → gradient 추정 분산 → ...).

---

## 마무리

이 교재의 목표는 "ES 의 한 식 $\hat g = \frac{1}{N\sigma} \sum r_i \epsilon_i$ 와 NN 의 한 식 $h = \phi(Wx + b)$ 안에 숨은 수학을 1~9 장에서 한 줄씩 떼어내 보여 주고, 10 장에서 다시 합쳐서 보는 것" 이었다. 코드는 [Docs/ML_교과서/](../ML_교과서/) 가 풀어 쓴 그대로 있다. 그 코드를 보면서 지금쯤 *왜 그렇게 적혀 있는지* 의 답이 떠오른다면, 이 교재는 제 역할을 한 셈.
