from dotenv import load_dotenv
from langchain_classic.globals import set_verbose, set_debug
from langchain_classic.output_parsers import PydanticOutputParser
from langchain_groq.chat_models import ChatGroq
from langgraph.constants import END
from langgraph.graph import StateGraph
from langgraph.prebuilt import create_react_agent

from coder_buddy.prompt import *
from coder_buddy.states import *
from coder_buddy.tools import write_file, read_file, get_current_directory, list_files

_ = load_dotenv()
set_debug(True)
set_verbose(True)
llm = ChatGroq(model="openai/gpt-oss-120b")

def planner_agent(state: dict) -> dict:
    user_prompt = state["user_prompt"]

    parser = PydanticOutputParser(pydantic_object=Plan)
    format_instructions = parser.get_format_instructions()

    prompt = planner_prompt(user_prompt) + "\n\n" + format_instructions

    response = llm.invoke(prompt)

    parsed = parser.parse(response.content)

    return {"plan": parsed}


def architect_agent(state: dict) -> dict:
    plan: Plan = state["plan"]
    parser = PydanticOutputParser(pydantic_object=TaskPlan)
    format_instructions = parser.get_format_instructions()
    prompt = architect_prompt(
        plan=plan.model_dump_json(indent=2)
    ) + "\n\n" + format_instructions
    response = llm.invoke(prompt)
    parsed = parser.parse(response.content)
    parsed.plan = plan

    return {"task_plan": parsed}

def coder_agent(state: dict) -> dict:
    coder_state: CoderState = state.get("coder_state")
    if coder_state is None:
        coder_state = CoderState(
            task_plan=state["task_plan"],
            current_step_idx=0
        )
    steps = coder_state.task_plan.implementation_steps
    if coder_state.current_step_idx >= len(steps):
        return {
            "coder_state": coder_state,
            "status": "DONE"
        }
    current_task = steps[coder_state.current_step_idx]
    existing_content = read_file.run(current_task.filepath)
    system_prompt = coder_system_prompt()
    user_prompt = (
        f"Task: {current_task.task_description}\n"
        f"File: {current_task.filepath}\n"
        f"Existing content:\n{existing_content}\n\n"
        "Use write_file(path, content) to save your changes."
    )
    coder_tools = [
        read_file,
        write_file,
        list_files,
        get_current_directory
    ]
    react_agent = create_react_agent(llm, coder_tools)
    react_agent.invoke({
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
    })
    coder_state.current_step_idx += 1
    return {"coder_state": coder_state}

graph = StateGraph(dict)
graph.add_node("planner", planner_agent)
graph.add_node("architect", architect_agent)
graph.add_node("coder", coder_agent)
graph.add_edge("planner", "architect")
graph.add_edge("architect", "coder")
graph.add_conditional_edges(
    "coder",
    lambda s: "END" if s.get("status") == "DONE" else "coder",
    {"END": END, "coder": "coder"},
)

graph.set_entry_point("planner")
agent = graph.compile()
if __name__ == "__main__":
    result = agent.invoke(
        {"user_prompt": "Build a Calculator"},
        {"recursion_limit": 100}
    )

    print("\nFinal State:\n", result)
